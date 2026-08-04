import { describe, expect, test } from 'bun:test'
import { FUZZY_FLOOR, ftsQuery, fuzzyScore, normaliseBm25, rank } from './search.ts'

describe('ftsQuery', () => {
  test('ORs terms so a partly-wrong query still returns something', () => {
    expect(ftsQuery(['metric', 'units'], false)).toBe('"metric" OR "units"')
  })

  test('adds prefix matching outside keyword mode', () => {
    expect(ftsQuery(['metric'], true)).toBe('"metric"*')
  })

  test('escapes quotes rather than letting them break the expression', () => {
    expect(ftsQuery(['say"hi'], false)).toBe('"say""hi"')
  })

  test('returns null when nothing is searchable', () => {
    expect(ftsQuery(['---', '!!'], false)).toBeNull()
    expect(ftsQuery([], false)).toBeNull()
  })
})

describe('normaliseBm25', () => {
  test('turns lower-is-better into higher-is-better inside 0..1', () => {
    const better = normaliseBm25(-8)
    const worse = normaliseBm25(-1)
    expect(better).toBeGreaterThan(worse)
    expect(better).toBeLessThan(1)
    expect(worse).toBeGreaterThan(0)
  })

  test('floors a non-negative score at zero', () => {
    expect(normaliseBm25(2)).toBe(0)
  })
})

describe('fuzzyScore', () => {
  test('scores an exact substring at one', () => {
    expect(fuzzyScore('metric units', 'Prefers metric units in all outputs')).toBe(1)
  })

  test('survives a typo above the floor', () => {
    expect(fuzzyScore('metirc units', 'Prefers metric units')).toBeGreaterThan(FUZZY_FLOOR)
  })

  test('scores unrelated text below the floor', () => {
    expect(fuzzyScore('thermostat', 'Kestrel ships in September')).toBeLessThan(FUZZY_FLOOR)
  })

  test('does not punish a short query against a long memory', () => {
    // Containment, not Jaccard: the length gap here would sink a symmetric measure.
    const long = 'opal/parser panics on empty frontmatter in the 2.3 branch of the runtime'
    expect(fuzzyScore('opal', long)).toBeGreaterThan(FUZZY_FLOOR)
    expect(fuzzyScore('opal', long)).toBeCloseTo(fuzzyScore('opal', 'opal/parser panics'), 10)
  })

  test('is zero for an empty query', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
})

describe('rank', () => {
  test('lets relevance dominate strength', () => {
    expect(rank(1, 0)).toBeGreaterThan(rank(0.5, 1))
  })

  test('uses strength to break ties between equally relevant memories', () => {
    expect(rank(0.8, 0.9)).toBeGreaterThan(rank(0.8, 0.2))
  })
})
