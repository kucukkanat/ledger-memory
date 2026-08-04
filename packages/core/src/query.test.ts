import { describe, expect, test } from 'bun:test'
import { isTimeTravel, parseDate, parseQuery } from './query.ts'

const NOW = Date.parse('2026-08-03T09:00:00Z')
const DAY = 86_400_000

const parse = (input: string) => parseQuery(input, NOW)
const ok = (input: string) => parse(input)._unsafeUnwrap()

describe('free text', () => {
  test('lowercases and keeps every non-filter token', () => {
    expect(ok('Metric Units Please').terms).toEqual(['metric', 'units', 'please'])
  })

  test('treats an unknown key as free text, not an error', () => {
    expect(ok('colour:blue').terms).toEqual(['colour:blue'])
  })

  test('treats a leading colon as free text', () => {
    expect(ok(':nope').terms).toEqual([':nope'])
  })

  test('is empty for an empty query', () => {
    const q = ok('   ')
    expect(q.terms).toEqual([])
    expect(q.cluster).toEqual([])
  })
})

describe('filters', () => {
  test('extracts each supported key', () => {
    const q = ok('agent:wren cluster:code type:doc kind:claim')
    expect(q.agent).toEqual(['wren'])
    expect(q.cluster).toEqual(['code'])
    expect(q.type).toEqual(['doc'])
    expect(q.kind).toEqual(['claim'])
    expect(q.terms).toEqual([])
  })

  test('repeating a key widens rather than narrows', () => {
    expect(ok('agent:wren agent:forge').agent).toEqual(['wren', 'forge'])
  })

  test('ignores a bare key so mid-typing is not an error', () => {
    const q = ok('agent: metric')
    expect(q.agent).toEqual([])
    expect(q.terms).toEqual(['metric'])
  })

  test('mixes filters and free text', () => {
    const q = ok('node 22 cluster:code')
    expect(q.terms).toEqual(['node', '22'])
    expect(q.cluster).toEqual(['code'])
  })
})

describe('strength', () => {
  test('converts the 0-100 query scale to 0-1', () => {
    expect(ok('strength:<40').strength).toEqual({ op: '<', value: 0.4 })
    expect(ok('strength:>70').strength).toEqual({ op: '>', value: 0.7 })
  })

  test('rejects a bound without a comparator', () => {
    const failure = parse('strength:40')._unsafeUnwrapErr()
    expect(failure.kind).toBe('invalid-query')
  })

  test('rejects a value above 100', () => {
    expect(parse('strength:>140').isErr()).toBe(true)
  })
})

describe('dates', () => {
  test('parses relative spans', () => {
    expect(parseDate('30d', NOW)).toBe(NOW - 30 * DAY)
    expect(parseDate('2w', NOW)).toBe(NOW - 14 * DAY)
    expect(parseDate('1y', NOW)).toBe(NOW - 365 * DAY)
    expect(parseDate('6mo', NOW)).toBe(NOW - 6 * 30.4 * DAY)
  })

  test('parses absolute dates', () => {
    expect(parseDate('2026-01-01', NOW)).toBe(Date.parse('2026-01-01'))
  })

  test('returns null for nonsense', () => {
    expect(parseDate('yesterday-ish', NOW)).toBeNull()
  })

  test('surfaces an unparseable date as a query failure naming the token', () => {
    const failure = parse('asof:soon')._unsafeUnwrapErr()
    expect(failure).toMatchObject({
      kind: 'invalid-query',
      token: 'asof:soon',
    })
  })

  test('asof, before and after land in separate fields', () => {
    const q = ok('asof:2026-01-01 before:2026-06-01 after:2025-01-01')
    expect(q.asOf).toBe(Date.parse('2026-01-01'))
    expect(q.before).toBe(Date.parse('2026-06-01'))
    expect(q.after).toBe(Date.parse('2025-01-01'))
  })

  test('only asof counts as time travel', () => {
    expect(isTimeTravel(ok('asof:2026-01-01'))).toBe(true)
    expect(isTimeTravel(ok('before:2026-01-01'))).toBe(false)
  })
})
