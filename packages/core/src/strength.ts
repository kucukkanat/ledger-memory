import type { StrengthFactors } from './types.ts'

const DAY = 86_400_000

/** Reads at which `used` saturates. Beyond this, more retrieval proves nothing new. */
const USE_CEILING = 300

/** Time constant of the freshness decay: a memory unread for this long keeps ~37% of its freshness. */
export const FRESHNESS_TAU_DAYS = 190

/** Independent corroborations (sources + agents beyond the first of each) at which trust saturates. */
const CORROBORATION_CEILING = 3

/**
 * Weights of the three signals. The floor is what a brand-new, never-read,
 * single-source claim is worth: not nothing, but not much.
 */
export const WEIGHTS = {
  floor: 0.17,
  used: 0.27,
  fresh: 0.34,
  corroborated: 0.22,
} as const

/** A claim never reaches certainty and never quite reaches zero. */
export const BOUNDS = { min: 0.04, max: 0.99 } as const

/** Pinning opts a claim out of decay entirely — it is held here regardless of use. */
export const PINNED_STRENGTH = BOUNDS.max

/** Chunk strength is clamped to this band so a source's trust cannot imply certainty. */
export const CHUNK_BOUNDS = { min: 0.15, max: 0.97 } as const

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export type StrengthInput = {
  readonly hits: number
  readonly lastReadAt: number
  readonly sourceCount: number
  readonly readerCount: number
  readonly now: number
}

/** The three signals, each normalised to 0..1. */
export const factorsOf = (input: StrengthInput): StrengthFactors => ({
  used: clamp(Math.log1p(Math.max(0, input.hits)) / Math.log1p(USE_CEILING), 0, 1),
  fresh: Math.exp(-Math.max(0, input.now - input.lastReadAt) / (DAY * FRESHNESS_TAU_DAYS)),
  corroborated: clamp(
    (Math.max(1, input.sourceCount) + Math.max(1, input.readerCount) - 2) / CORROBORATION_CEILING,
    0,
    1,
  ),
})

/** Weighted strength of a claim, from its three signals. */
export const strengthOf = (factors: StrengthFactors): number =>
  clamp(
    WEIGHTS.floor +
      WEIGHTS.used * factors.used +
      WEIGHTS.fresh * factors.fresh +
      WEIGHTS.corroborated * factors.corroborated,
    BOUNDS.min,
    BOUNDS.max,
  )

/**
 * Strength of a chunk: whatever its source is trusted at, clamped.
 *
 * Chunks deliberately do not decay. A document is either trustworthy or it is
 * not, and that judgement belongs to the source, not to how often a particular
 * paragraph happened to be retrieved.
 */
export const chunkStrength = (sourceTrust: number): number =>
  clamp(sourceTrust, CHUNK_BOUNDS.min, CHUNK_BOUNDS.max)

/** Days of no reads before a claim's strength falls to `target`, ignoring other signals. */
export const daysUntil = (input: StrengthInput, target: number): number => {
  const f = factorsOf(input)
  const withoutFresh = WEIGHTS.floor + WEIGHTS.used * f.used + WEIGHTS.corroborated * f.corroborated
  const headroom = (target - withoutFresh) / WEIGHTS.fresh
  if (headroom <= 0) return Number.POSITIVE_INFINITY
  if (headroom >= 1) return 0
  const totalDays = -FRESHNESS_TAU_DAYS * Math.log(headroom)
  const elapsedDays = (input.now - input.lastReadAt) / DAY
  return Math.max(0, totalDays - elapsedDays)
}
