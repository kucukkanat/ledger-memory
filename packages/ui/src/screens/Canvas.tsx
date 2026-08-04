import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphResponse } from '../api.ts'
import {
  type ColorMode,
  colorOf,
  computeLayout,
  LAYOUT_NOTES,
  type Layout,
  laneCentre,
  radiusOf,
} from '../canvas/layouts.ts'
import { agentColor, ago, dateStr, fmtN, strengthColor } from '../format.ts'
import { useSize } from '../hooks.ts'

/**
 * The canvas.
 *
 * Drawn to a 2D context rather than to SVG or DOM: at a few thousand memories
 * this is one draw call per frame against thousands of retained nodes, and the
 * time scrubber has to stay smooth while it redraws every frame.
 *
 * Positions ease toward their layout targets instead of snapping, so switching
 * layouts shows you that it is the *same* memories rearranged — which is the
 * only reason to have four layouts rather than four screens.
 */

export type CanvasProps = {
  graph: GraphResponse
  showChunks: boolean
  onShowChunks: (next: boolean) => void
  onOpenMemory: (id: string) => void
}

type Hover = { x: number; y: number; text: string; meta: string } | null

const EASE = 0.16

export const Canvas = ({ graph, showChunks, onShowChunks, onOpenMemory }: CanvasProps) => {
  const { ref: shell, size } = useSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [layout, setLayout] = useState<Layout>('clusters')
  const [color, setColor] = useState<ColorMode>('cluster')
  const [showLinks, setShowLinks] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [until, setUntil] = useState(100)
  const [minStrength, setMinStrength] = useState(0)
  const [minHits, setMinHits] = useState(0)
  const [hiddenClusters, setHiddenClusters] = useState<ReadonlySet<string>>(new Set())
  const [hover, setHover] = useState<Hover>(null)
  const [playing, setPlaying] = useState(false)
  const [noteOpen, setNoteOpen] = useState(true)

  const clusterIds = useMemo(() => graph.clusters.map((c) => c.id), [graph.clusters])

  const span = useMemo(() => {
    const times = graph.nodes.map((n) => n.createdAt)
    return {
      from: Math.min(...times, Date.now()),
      to: Math.max(...times, Date.now()),
    }
  }, [graph.nodes])

  const untilTime = span.from + (until / 100) * (span.to - span.from)

  const visible = useMemo(
    () =>
      graph.nodes.filter(
        (node) =>
          node.createdAt <= untilTime &&
          node.strength * 100 >= minStrength &&
          node.hits >= minHits &&
          !hiddenClusters.has(node.cluster),
      ),
    [graph.nodes, untilTime, minStrength, minHits, hiddenClusters],
  )

  const targets = useMemo(
    () =>
      computeLayout({
        nodes: graph.nodes,
        links: graph.links,
        layout,
        clusterIds,
        until: untilTime,
        span,
      }),
    // Recomputing on every scrubber tick would be wasteful; positions are a
    // function of the layout and the full node set, not of what is filtered.
    [graph.nodes, graph.links, clusterIds, layout, span, untilTime],
  )

  /** Live positions, eased toward targets. Kept in a ref so the loop is allocation-free. */
  const live = useRef(new Map<string, { x: number; y: number }>())
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible])
  const maxHits = useMemo(() => Math.max(1, ...graph.nodes.map((n) => n.hits)), [graph.nodes])

  /** World→screen transform, fitted to the current layout extent. */
  const view = useRef({ scale: 1, ox: 0, oy: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || size.width === 0) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    let frame = 0
    const draw = (): void => {
      // Ease first, then fit — in that order, and deliberately.
      //
      // The fit has to be computed over the positions actually about to be
      // drawn. Fitting the *targets* instead looks equivalent but is not: any
      // node whose live position has not reached its target (mid-transition, or
      // a target that never arrived) is then drawn outside the box the fit
      // reserved for it, and the whole view spills past the panels.
      for (const node of graph.nodes) {
        const target = targets.get(node.id)
        if (!target) continue
        const current = live.current.get(node.id) ?? {
          x: target.x,
          y: target.y,
        }
        current.x += (target.x - current.x) * EASE
        current.y += (target.y - current.y) * EASE
        live.current.set(node.id, current)
      }

      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (const node of visible) {
        const position = live.current.get(node.id)
        // Guard against a non-finite coordinate poisoning the whole extent:
        // one NaN would make every comparison NaN and silently blow the scale up.
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) continue
        if (position.x < minX) minX = position.x
        if (position.y < minY) minY = position.y
        if (position.x > maxX) maxX = position.x
        if (position.y > maxY) maxY = position.y
      }
      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
        minX = -100
        minY = -100
        maxX = 100
        maxY = 100
      }

      // Space the floating panels occupy, reserved so nodes never slide under
      // them. Fit and centring must use the same numbers or content lands
      // outside the area the fit was computed for.
      // The timeline gets a wider left gutter for its lane labels; the other
      // layouts only need to clear the floating panels.
      const inset = {
        top: 44,
        right: 210,
        bottom: 88,
        left: layout === 'time' ? 330 : 210,
      }
      const frameWidth = Math.max(80, size.width - inset.left - inset.right)
      const frameHeight = Math.max(80, size.height - inset.top - inset.bottom)

      const scale = Math.min(
        frameWidth / Math.max(1, maxX - minX),
        frameHeight / Math.max(1, maxY - minY),
      )
      view.current = {
        scale,
        ox: inset.left + frameWidth / 2 - ((minX + maxX) / 2) * scale,
        oy: inset.top + frameHeight / 2 - ((minY + maxY) / 2) * scale,
      }
      const { ox, oy } = view.current
      const toScreen = (p: { x: number; y: number }) => ({
        x: p.x * scale + ox,
        y: p.y * scale + oy,
      })

      context.clearRect(0, 0, size.width, size.height)

      if (showLinks && layout !== 'heat') {
        context.strokeStyle = 'rgba(120, 132, 145, 0.14)'
        context.lineWidth = 0.6
        context.beginPath()
        for (const link of graph.links) {
          if (!visibleIds.has(link.a) || !visibleIds.has(link.b)) continue
          const a = live.current.get(link.a)
          const b = live.current.get(link.b)
          if (!a || !b) continue
          const sa = toScreen(a)
          const sb = toScreen(b)
          context.moveTo(sa.x, sa.y)
          context.lineTo(sb.x, sb.y)
        }
        context.stroke()
      }

      for (const node of visible) {
        const position = live.current.get(node.id)
        if (!position) continue
        const { x, y } = toScreen(position)
        const r = radiusOf(node, maxHits)
        context.beginPath()
        context.arc(x, y, r, 0, Math.PI * 2)
        context.fillStyle = colorOf(node, color, agentColor, strengthColor)
        context.globalAlpha = node.kind === 'chunk' ? 0.35 : 0.85
        context.fill()
        context.globalAlpha = 1

        if (node.pinned) {
          context.strokeStyle = '#c0f24a'
          context.lineWidth = 1.2
          context.stroke()
        }
        if (node.conflict) {
          context.strokeStyle = '#f2913f'
          context.lineWidth = 1.4
          context.stroke()
        }
      }

      if (showLabels && layout === 'clusters') {
        // Label each cluster at the centroid of what is actually visible.
        const centroids = new Map<string, { x: number; y: number; n: number }>()
        for (const node of visible) {
          const position = live.current.get(node.id)
          if (!position) continue
          const accumulator = centroids.get(node.cluster) ?? {
            x: 0,
            y: 0,
            n: 0,
          }
          accumulator.x += position.x
          accumulator.y += position.y
          accumulator.n += 1
          centroids.set(node.cluster, accumulator)
        }
        context.font = "500 11px 'Instrument Sans', system-ui, sans-serif"
        context.textAlign = 'center'
        // A label sits on top of its own dot cloud, so it needs to be separated
        // from it. A stroke in the page background reads as a halo and keeps
        // the label legible over any cluster colour, at any density.
        context.lineJoin = 'round'
        context.lineWidth = 3
        context.strokeStyle = 'rgba(10, 11, 12, 0.85)'
        for (const cluster of graph.clusters) {
          const centroid = centroids.get(cluster.id)
          if (!centroid || centroid.n < 3) continue
          const point = toScreen({
            x: centroid.x / centroid.n,
            y: centroid.y / centroid.n,
          })
          context.strokeText(cluster.label, point.x, point.y - 4)
          context.fillStyle = 'rgba(231, 233, 235, 0.95)'
          context.fillText(cluster.label, point.x, point.y - 4)

          context.font = "400 9px 'Geist Mono', ui-monospace, monospace"
          context.strokeText(String(centroid.n), point.x, point.y + 9)
          context.fillStyle = 'rgba(134, 141, 149, 0.85)'
          context.fillText(String(centroid.n), point.x, point.y + 9)
          context.font = "500 11px 'Instrument Sans', system-ui, sans-serif"
        }
        context.lineWidth = 1
        context.textAlign = 'left'
      }

      if (showLabels && layout === 'time') {
        // Label the lanes at the left edge — a band of colour means nothing
        // without knowing which topic it is.
        context.font = "400 10px 'Instrument Sans', system-ui, sans-serif"
        context.textAlign = 'right'
        for (const cluster of graph.clusters) {
          if (hiddenClusters.has(cluster.id)) continue
          const y = toScreen({ x: 0, y: laneCentre(clusterIds, cluster.id) }).y
          context.fillStyle = cluster.color
          context.globalAlpha = 0.75
          context.fillText(cluster.label, inset.left - 12, y + 3)
          context.globalAlpha = 1
        }
        context.textAlign = 'left'
      }

      if (layout === 'heat') {
        context.font = "400 9px 'Geist Mono', ui-monospace, monospace"
        context.fillStyle = 'rgba(78, 85, 92, 0.9)'
        // Centred under the plot rather than pinned to the left edge, where it
        // ran into the floating "what am I looking at" button.
        context.textAlign = 'center'
        context.fillText(
          '← never retrieved          retrieved often →',
          inset.left + frameWidth / 2,
          size.height - inset.bottom + 22,
        )
        context.save()
        context.translate(inset.left - 22, inset.top + frameHeight / 2)
        context.rotate(-Math.PI / 2)
        context.fillText('← decaying          strong →', 0, 0)
        context.restore()
        context.textAlign = 'left'
      }

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [
    size,
    targets,
    visible,
    visibleIds,
    graph,
    clusterIds,
    hiddenClusters,
    layout,
    color,
    showLinks,
    showLabels,
    maxHits,
  ])

  /** Play sweeps the as-of scrubber, replaying how the store filled up. */
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setUntil((value) => {
        if (value >= 100) {
          setPlaying(false)
          return 100
        }
        return value + 1
      })
    }, 90)
    return () => clearInterval(timer)
  }, [playing])

  const onMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const { scale, ox, oy } = view.current

      let best: { node: (typeof visible)[number]; distance: number } | null = null
      for (const node of visible) {
        const position = live.current.get(node.id)
        if (!position) continue
        const distance = Math.hypot(position.x * scale + ox - px, position.y * scale + oy - py)
        if (distance < 9 && (!best || distance < best.distance)) best = { node, distance }
      }

      setHover(
        best
          ? {
              x: Math.min(px + 14, size.width - 330),
              y: Math.min(py + 14, size.height - 110),
              text: best.node.text,
              meta: `${best.node.cluster} · ${best.node.writer} · str ${Math.round(
                best.node.strength * 100,
              )} · ${fmtN(best.node.hits)} reads · ${ago(best.node.createdAt)} old`,
            }
          : null,
      )
    },
    [visible, size],
  )

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const { scale, ox, oy } = view.current
      for (const node of visible) {
        const position = live.current.get(node.id)
        if (!position) continue
        if (Math.hypot(position.x * scale + ox - px, position.y * scale + oy - py) < 9) {
          onOpenMemory(node.id)
          return
        }
      }
    },
    [visible, onOpenMemory],
  )

  const legend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of visible) {
      const key =
        color === 'agent'
          ? node.writer
          : color === 'strength'
            ? node.strength > 0.7
              ? 'strong'
              : node.strength > 0.4
                ? 'holding'
                : 'decaying'
            : color === 'heat'
              ? node.hits > 60
                ? 'hot'
                : node.hits > 12
                  ? 'warm'
                  : 'cold'
              : node.cluster
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const clusterLabels = new Map(graph.clusters.map((c) => [c.id, c]))
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, n]) => ({
        key,
        label: clusterLabels.get(key)?.label ?? key,
        n,
        tint:
          color === 'cluster'
            ? (clusterLabels.get(key)?.color ?? '#868d95')
            : color === 'agent'
              ? agentColor(key)
              : color === 'strength'
                ? key === 'strong'
                  ? '#c0f24a'
                  : key === 'holding'
                    ? '#d9a03c'
                    : '#e0555f'
                : key === 'hot'
                  ? '#c0f24a'
                  : key === 'warm'
                    ? '#d9a03c'
                    : '#575e66',
        toggleable: color === 'cluster',
      }))
  }, [visible, color, graph.clusters])

  const histogram = useMemo(() => {
    const buckets = 60
    const width = Math.max(1, span.to - span.from)
    const counts = new Array<number>(buckets).fill(0)
    for (const node of graph.nodes) {
      const index = Math.min(
        buckets - 1,
        Math.floor(((node.createdAt - span.from) / width) * buckets),
      )
      counts[index] = (counts[index] ?? 0) + 1
    }
    const peak = Math.max(1, ...counts)
    return counts.map((n, i) => ({
      height: `${Math.max(2, (n / peak) * 100)}%`,
      past: i / buckets <= until / 100,
    }))
  }, [graph.nodes, span, until])

  return (
    <div className="canvas" ref={shell}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
      />

      <div className="canvas__segments" style={{ top: 12, left: 12 }}>
        {(['clusters', 'graph', 'time', 'heat'] as const).map((option) => (
          <button
            type="button"
            key={option}
            className={`canvas__segment${layout === option ? ' canvas__segment--on' : ''}`}
            title={LAYOUT_NOTES[option]}
            onClick={() => setLayout(option)}
          >
            {option === 'time' ? 'TIMELINE' : option.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <div className="canvas__segments" style={{ position: 'relative', top: 0, right: 0 }}>
          <span
            className="canvas__segment"
            style={{ color: 'var(--lg-text-ghost)', cursor: 'default' }}
          >
            COLOR
          </span>
          {(
            [
              ['cluster', 'TOPIC'],
              ['agent', 'AGENT'],
              ['strength', 'STRENGTH'],
              ['heat', 'HEAT'],
            ] as const
          ).map(([mode, label]) => (
            <button
              type="button"
              key={mode}
              className={`canvas__segment${color === mode ? ' canvas__segment--toggle-on' : ''}`}
              onClick={() => setColor(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="canvas__segments" style={{ position: 'relative', top: 0, right: 0 }}>
          {(
            [
              ['CHUNKS', showChunks, () => onShowChunks(!showChunks)],
              ['LINKS', showLinks, () => setShowLinks((v) => !v)],
              ['LABELS', showLabels, () => setShowLabels((v) => !v)],
            ] as const
          ).map(([label, on, toggle]) => (
            <button
              type="button"
              key={label}
              className={`canvas__segment${on ? ' canvas__segment--toggle-on' : ''}`}
              onClick={toggle}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="canvas__float"
        style={{
          top: 52,
          left: 12,
          width: 196,
          maxHeight: 'calc(100% - 160px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 11px 6px',
            borderBottom: '1px solid var(--lg-border-subtle)',
          }}
        >
          <span className="eyebrow">VIEW FILTERS</span>
          <button
            type="button"
            className="selbar__link"
            style={{ fontSize: 9 }}
            onClick={() => {
              setMinStrength(0)
              setMinHits(0)
              setHiddenClusters(new Set())
              setUntil(100)
            }}
          >
            RESET
          </button>
        </div>
        <div style={{ padding: '9px 11px 3px' }}>
          <div className="eyebrow">
            STRENGTH ≥ <span className="accent">{minStrength}</span>
          </div>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={minStrength}
            onChange={(e) => setMinStrength(Number(e.target.value))}
            style={{ width: '100%', height: 14 }}
          />
          <div className="eyebrow">
            MIN READS <span className="accent">{minHits}</span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            step={4}
            value={minHits}
            onChange={(e) => setMinHits(Number(e.target.value))}
            style={{ width: '100%', height: 14 }}
          />
        </div>
      </div>

      <div
        className="canvas__float"
        style={{ right: 12, bottom: 88, padding: '9px 11px', maxWidth: 200 }}
      >
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {color === 'cluster'
            ? 'TOPIC'
            : color === 'agent'
              ? 'AGENT'
              : color === 'strength'
                ? 'STRENGTH'
                : 'RETRIEVAL'}
        </div>
        {legend.map((item) => (
          <button
            type="button"
            key={item.key}
            className="canvas__legend-item"
            onClick={() => {
              if (!item.toggleable) return
              setHiddenClusters((current) => {
                const next = new Set(current)
                if (next.has(item.key)) next.delete(item.key)
                else next.add(item.key)
                return next
              })
            }}
            style={{ opacity: hiddenClusters.has(item.key) ? 0.35 : 1 }}
          >
            <span className="dot" style={{ width: 7, height: 7, background: item.tint }} />
            <span
              style={{
                flex: 1,
                fontSize: 10.5,
                color: 'var(--lg-text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--lg-text-trace)' }}>
              {fmtN(item.n)}
            </span>
          </button>
        ))}
      </div>

      {noteOpen && (
        <div
          className="canvas__float"
          style={{ left: 220, bottom: 88, maxWidth: 380, padding: '8px 10px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <div className="mono muted" style={{ flex: 1, fontSize: 10.5, lineHeight: 1.5 }}>
              {LAYOUT_NOTES[layout]}
            </div>
            <button
              type="button"
              className="selbar__link"
              style={{ textDecoration: 'none' }}
              onClick={() => setNoteOpen(false)}
              title="dismiss"
            >
              ✕
            </button>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              lineHeight: 1.5,
              color: 'var(--lg-text-trace)',
              marginTop: 5,
            }}
          >
            Ringed in lime = pinned · ringed in amber = in conflict · faded = document chunk
          </div>
        </div>
      )}
      {!noteOpen && (
        <button
          type="button"
          className="canvas__float"
          onClick={() => setNoteOpen(true)}
          title="what am I looking at?"
          style={{
            left: 220,
            bottom: 88,
            width: 22,
            height: 22,
            color: 'var(--lg-text-faint)',
            cursor: 'pointer',
          }}
        >
          ?
        </button>
      )}

      {hover && (
        <div className="canvas__tooltip" style={{ left: hover.x, top: hover.y }}>
          <div style={{ fontSize: 12, lineHeight: 1.35, marginBottom: 5 }}>{hover.text}</div>
          <div className="mono dim" style={{ fontSize: 9.5, letterSpacing: '0.04em' }}>
            {hover.meta}
          </div>
        </div>
      )}

      <div className="canvas__float canvas__scrubber">
        <button
          type="button"
          className="btn"
          onClick={() => setPlaying((p) => !p)}
          style={{
            width: 26,
            height: 26,
            justifyContent: 'center',
            padding: 0,
          }}
          title="replay how the store filled up"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div style={{ flex: 'none', width: 150 }} className="mono">
          <div className="eyebrow">KNOWLEDGE AS OF</div>
          <div style={{ fontSize: 13, letterSpacing: '-0.01em' }}>{dateStr(untilTime)}</div>
        </div>
        <div className="canvas__histogram">
          <div className="canvas__bars">
            {histogram.map((bar, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length histogram, index is the identity
                key={i}
                style={{
                  height: bar.height,
                  background: bar.past ? 'var(--lg-accent-dim)' : '#181c1f',
                }}
              />
            ))}
          </div>
          <input
            type="range"
            className="canvas__range"
            min={2}
            max={100}
            value={until}
            onChange={(e) => setUntil(Number(e.target.value))}
          />
        </div>
        <div className="mono" style={{ flex: 'none', textAlign: 'right', width: 110 }}>
          <div className="eyebrow">IN VIEW</div>
          <div className="accent" style={{ fontSize: 13 }}>
            {fmtN(visible.length)}
          </div>
        </div>
      </div>
    </div>
  )
}
