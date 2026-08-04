import { describe, expect, test } from 'bun:test'
import {
  BOUNDS,
  CHUNK_BOUNDS,
  chunkStrength,
  daysUntil,
  FRESHNESS_TAU_DAYS,
  factorsOf,
  PINNED_STRENGTH,
  strengthOf,
  WEIGHTS,
} from './strength.ts'

const DAY = 86_400_000
const NOW = Date.parse('2026-08-03T09:00:00Z')

const at = (overrides: Partial<Parameters<typeof factorsOf>[0]> = {}) =>
  factorsOf({
    hits: 0,
    lastReadAt: NOW,
    sourceCount: 1,
    readerCount: 1,
    now: NOW,
    ...overrides,
  })

describe('factors', () => {
  test('a brand-new unread claim scores zero on used and corroborated, full on fresh', () => {
    const f = at()
    expect(f.used).toBe(0)
    expect(f.fresh).toBeCloseTo(1, 10)
    expect(f.corroborated).toBe(0)
  })

  test('used is log-scaled and saturates at the 300-read ceiling', () => {
    expect(at({ hits: 300 }).used).toBeCloseTo(1, 10)
    expect(at({ hits: 5000 }).used).toBe(1)
    // Log scaling: the first few reads move the needle far more than the last few.
    const first = at({ hits: 10 }).used - at({ hits: 0 }).used
    const last = at({ hits: 300 }).used - at({ hits: 290 }).used
    expect(first).toBeGreaterThan(last * 10)
  })

  test('freshness halves on the documented time constant', () => {
    const f = at({ lastReadAt: NOW - FRESHNESS_TAU_DAYS * DAY })
    expect(f.fresh).toBeCloseTo(Math.exp(-1), 10)
  })

  test('corroboration counts sources and agents beyond the first of each', () => {
    expect(at({ sourceCount: 1, readerCount: 1 }).corroborated).toBe(0)
    expect(at({ sourceCount: 2, readerCount: 1 }).corroborated).toBeCloseTo(1 / 3, 10)
    expect(at({ sourceCount: 3, readerCount: 3 }).corroborated).toBe(1)
  })

  test('a future lastReadAt cannot produce freshness above one', () => {
    expect(at({ lastReadAt: NOW + 10 * DAY }).fresh).toBe(1)
  })

  test('negative hits are floored rather than producing NaN', () => {
    expect(at({ hits: -5 }).used).toBe(0)
  })
})

describe('strength', () => {
  test('sits at the floor for a claim with no evidence and no freshness', () => {
    const dead = strengthOf({ used: 0, fresh: 0, corroborated: 0 })
    expect(dead).toBeCloseTo(WEIGHTS.floor, 10)
    expect(dead).toBeGreaterThanOrEqual(BOUNDS.min)
  })

  test('never reaches certainty even with every signal maxed', () => {
    expect(strengthOf({ used: 1, fresh: 1, corroborated: 1 })).toBe(BOUNDS.max)
  })

  test('weights sum with the floor to exactly the ceiling', () => {
    expect(WEIGHTS.floor + WEIGHTS.used + WEIGHTS.fresh + WEIGHTS.corroborated).toBeCloseTo(1, 10)
  })

  test('freshness is the heaviest single signal', () => {
    expect(WEIGHTS.fresh).toBeGreaterThan(WEIGHTS.used)
    expect(WEIGHTS.fresh).toBeGreaterThan(WEIGHTS.corroborated)
  })

  test('an unread claim decays below a heavily-read stale one', () => {
    const neglected = strengthOf(at({ hits: 0, lastReadAt: NOW - 400 * DAY }))
    const relied = strengthOf(at({ hits: 250, lastReadAt: NOW - 400 * DAY }))
    expect(relied).toBeGreaterThan(neglected)
  })
})

describe('chunk strength', () => {
  test('is its source trust, clamped', () => {
    expect(chunkStrength(0.62)).toBe(0.62)
    expect(chunkStrength(1)).toBe(CHUNK_BOUNDS.max)
    expect(chunkStrength(0)).toBe(CHUNK_BOUNDS.min)
  })

  test('does not depend on time — chunks do not decay', () => {
    expect(chunkStrength(0.8)).toBe(chunkStrength(0.8))
  })
})

describe('pinning', () => {
  test('is held at the ceiling, above anything decay can reach', () => {
    expect(PINNED_STRENGTH).toBe(BOUNDS.max)
    expect(strengthOf(at({ hits: 100, lastReadAt: NOW - 30 * DAY }))).toBeLessThan(PINNED_STRENGTH)
  })
})

describe('daysUntil', () => {
  test('reports zero when the claim is already below the target', () => {
    const input = {
      hits: 0,
      lastReadAt: NOW - 900 * DAY,
      sourceCount: 1,
      readerCount: 1,
      now: NOW,
    }
    expect(daysUntil(input, 0.5)).toBe(0)
  })

  test('reports infinity when other signals already hold it above the target', () => {
    const input = {
      hits: 300,
      lastReadAt: NOW,
      sourceCount: 3,
      readerCount: 3,
      now: NOW,
    }
    expect(daysUntil(input, 0.3)).toBe(Number.POSITIVE_INFINITY)
  })

  test('predicts a decay date the formula agrees with', () => {
    const input = {
      hits: 20,
      lastReadAt: NOW,
      sourceCount: 1,
      readerCount: 2,
      now: NOW,
    }
    const days = daysUntil(input, 0.5)
    expect(days).toBeGreaterThan(0)
    expect(days).toBeFinite()
    const later = strengthOf(factorsOf({ ...input, now: NOW + days * DAY }))
    expect(later).toBeCloseTo(0.5, 6)
  })
})
