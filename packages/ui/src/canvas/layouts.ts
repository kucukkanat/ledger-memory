import type { GraphNode } from '../api.ts'

/**
 * The four canvas layouts.
 *
 * Each answers a different question, which is why they are layouts rather than
 * filters:
 *
 * - `clusters` — what does the fleet know, by topic
 * - `graph`    — how do memories link to each other
 * - `time`     — how did knowledge accumulate
 * - `heat`     — what is actually retrieved, versus dead weight
 *
 * Positions are computed once per layout change and then eased toward, so
 * switching reads as motion rather than as a cut.
 */

export type Layout = 'clusters' | 'graph' | 'time' | 'heat'
export type ColorMode = 'cluster' | 'agent' | 'strength' | 'heat'

export type Placed = {
  node: GraphNode
  /** Target position in world space. */
  tx: number
  ty: number
  /** Current position, eased toward the target each frame. */
  x: number
  y: number
  r: number
  visible: boolean
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/** World-space height of one cluster lane in the timeline layout. */
export const TIME_LANE_HEIGHT = 58

/** World-space y of a cluster's lane centre, for drawing lane labels. */
export const laneCentre = (clusterIds: readonly string[], clusterId: string): number => {
  const index = clusterIds.indexOf(clusterId)
  return (index - (clusterIds.length - 1) / 2) * TIME_LANE_HEIGHT
}

/** Deterministic per-node jitter so a layout looks the same on every render. */
const hash = (id: string): number => {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const RADIUS_MIN = 2.2
const RADIUS_MAX = 7

export const radiusOf = (node: GraphNode, maxHits: number): number =>
  RADIUS_MIN +
  (RADIUS_MAX - RADIUS_MIN) * Math.sqrt(maxHits === 0 ? 0 : Math.min(1, node.hits / maxHits))

/**
 * Pack cluster discs so none overlap.
 *
 * A golden-angle spiral gets them roughly placed, then relaxation pushes apart
 * any that still collide. Cheap, stable, and it does not need a physics engine.
 */
const packClusters = (
  clusterIds: readonly string[],
  sizes: ReadonlyMap<string, number>,
): Map<string, { x: number; y: number; r: number }> => {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5))
  const SQUASH = 0.82

  /**
   * Disc radius follows the square root of the count, so area reads as
   * quantity. The floor is what keeps a young store legible: a fixed minimum
   * sized for hundreds of memories per cluster leaves a store with four in
   * each looking like an empty screen with labels on it, so the floor grows
   * with the largest cluster rather than being a constant.
   */
  const largest = Math.max(1, ...[...sizes.values()])
  const floor = largest < 40 ? 16 : 40
  const scale = largest < 40 ? 22 : 15

  const radii = new Map(
    clusterIds.map((id) => [id, floor + Math.sqrt(Math.max(sizes.get(id) ?? 0, 1)) * scale]),
  )
  // Discs must clear each other, but a gap tuned for large discs isolates small
  // ones; keep it proportional to what is actually being drawn.
  const GAP = Math.max(18, Math.min(44, largest < 40 ? 22 : 44))
  const mean = [...radii.values()].reduce((sum, r) => sum + r, 0) / Math.max(1, radii.size)

  const ordered = [...clusterIds].sort((a, b) => (radii.get(b) ?? 0) - (radii.get(a) ?? 0))
  const positions = new Map<string, { x: number; y: number }>()
  ordered.forEach((id, index) => {
    const angle = index * GOLDEN
    const distance = mean * 1.95 * Math.sqrt(index)
    positions.set(id, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * SQUASH,
    })
  })

  for (let pass = 0; pass < 220; pass += 1) {
    let moved = false
    for (let i = 0; i < clusterIds.length; i += 1) {
      for (let j = i + 1; j < clusterIds.length; j += 1) {
        const idA = clusterIds[i]
        const idB = clusterIds[j]
        if (idA === undefined || idB === undefined) continue
        const a = positions.get(idA)
        const b = positions.get(idB)
        if (!a || !b) continue

        const dx = b.x - a.x
        const dy = (b.y - a.y) / SQUASH
        const needed = (radii.get(idA) ?? 0) + (radii.get(idB) ?? 0) + GAP
        const distance = Math.hypot(dx, dy) || 0.01
        if (distance < needed) {
          const push = (needed - distance) / 2
          const ux = dx / distance
          const uy = dy / distance
          a.x -= ux * push
          a.y -= uy * push * SQUASH
          b.x += ux * push
          b.y += uy * push * SQUASH
          moved = true
        }
      }
    }
    if (!moved && pass > 40) break
  }

  const centre = [...positions.values()].reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), {
    x: 0,
    y: 0,
  })
  const n = Math.max(1, positions.size)

  // The disc radius includes room for the label; nodes scatter inside a
  // slightly smaller circle so they never sit on top of the cluster name.
  return new Map(
    [...positions].map(([id, p]) => [
      id,
      {
        x: p.x - centre.x / n,
        y: p.y - centre.y / n,
        r: Math.max(10, (radii.get(id) ?? 70) * 0.68),
      },
    ]),
  )
}

/**
 * A few rounds of attract-along-links, repel-everything-else.
 *
 * Bounded iterations rather than a live simulation: the canvas has to stay
 * responsive while someone drags the time scrubber, and a settled-enough graph
 * that renders instantly beats a perfect one that stutters.
 */
const relaxGraph = (
  nodes: readonly GraphNode[],
  links: readonly { a: string; b: string }[],
  spread: number,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>(
    nodes.map((node) => {
      const angle = hash(node.id) * Math.PI * 2
      const distance = Math.sqrt(hash(`${node.id}r`)) * spread
      return [node.id, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }]
    }),
  )

  const degree = new Map<string, number>()
  for (const link of links) {
    degree.set(link.a, (degree.get(link.a) ?? 0) + 1)
    degree.set(link.b, (degree.get(link.b) ?? 0) + 1)
  }

  for (let pass = 0; pass < 60; pass += 1) {
    for (const link of links) {
      const a = positions.get(link.a)
      const b = positions.get(link.b)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy) || 0.01
      const pull = (distance - 60) * 0.008
      a.x += (dx / distance) * pull
      a.y += (dy / distance) * pull
      b.x -= (dx / distance) * pull
      b.y -= (dy / distance) * pull
    }
    // Centre-seeking keeps disconnected nodes from drifting off forever.
    for (const p of positions.values()) {
      p.x *= 0.997
      p.y *= 0.997
    }
  }

  return positions
}

export type LayoutInput = {
  nodes: readonly GraphNode[]
  links: readonly { a: string; b: string }[]
  layout: Layout
  clusterIds: readonly string[]
  /** Upper bound of the time axis — the as-of scrubber. */
  until: number
  span: { from: number; to: number }
}

export const computeLayout = (input: LayoutInput): Map<string, { x: number; y: number }> => {
  const { nodes, links, layout, clusterIds, span } = input
  const out = new Map<string, { x: number; y: number }>()

  if (layout === 'clusters') {
    const sizes = new Map<string, number>()
    for (const node of nodes) sizes.set(node.cluster, (sizes.get(node.cluster) ?? 0) + 1)
    const discs = packClusters(clusterIds, sizes)
    for (const node of nodes) {
      const disc = discs.get(node.cluster) ?? { x: 0, y: 0, r: 80 }
      const angle = hash(node.id) * Math.PI * 2
      const radius = Math.sqrt(hash(`${node.id}#`)) * disc.r
      out.set(node.id, {
        x: disc.x + Math.cos(angle) * radius,
        y: disc.y + Math.sin(angle) * radius,
      })
    }
    return out
  }

  if (layout === 'graph') {
    return relaxGraph(nodes, links, 420)
  }

  if (layout === 'time') {
    // x is when it was written, y is a lane per cluster. Jitter has to stay
    // well under the lane spacing or adjacent bands bleed into each other and
    // the whole point — seeing *which* topic grew when — is lost.
    const width = Math.max(1, span.to - span.from)
    const laneOf = new Map(clusterIds.map((id, i) => [id, i]))
    const lanes = Math.max(1, clusterIds.length)
    for (const node of nodes) {
      const lane = laneOf.get(node.cluster) ?? 0
      const x = ((node.createdAt - span.from) / width - 0.5) * 1100
      const y = (lane - (lanes - 1) / 2) * TIME_LANE_HEIGHT + (hash(node.id) - 0.5) * 16
      out.set(node.id, { x, y })
    }
    return out
  }

  // heat: retrieval on x, strength on y — the top-right corner is load-bearing
  // knowledge, the bottom-left is dead weight.
  const maxHits = Math.max(1, ...nodes.map((n) => n.hits))
  for (const node of nodes) {
    const x = (Math.log1p(node.hits) / Math.log1p(maxHits) - 0.5) * 1000
    const y = (0.5 - node.strength) * 620 + (hash(node.id) - 0.5) * 18
    out.set(node.id, { x, y })
  }
  return out
}

export const colorOf = (
  node: GraphNode,
  mode: ColorMode,
  agentColor: (id: string) => string,
  strengthColor: (strength: number) => string,
): string => {
  switch (mode) {
    case 'cluster':
      return node.color
    case 'agent':
      return agentColor(node.writer)
    case 'strength':
      return strengthColor(node.strength)
    case 'heat':
      return node.hits > 60 ? '#c0f24a' : node.hits > 12 ? '#d9a03c' : '#575e66'
  }
}

export const LAYOUT_NOTES: Record<Layout, string> = {
  clusters: 'Every memory the fleet holds, grouped by topic. Disc size is how much is in each.',
  graph: 'How memories link to each other. Isolated dots are things nothing else corroborates.',
  time: 'When each memory was written, banded by cluster. Gaps are periods nothing was learned.',
  heat: 'Retrieval against strength. Top right is load-bearing; bottom left is dead weight.',
}
