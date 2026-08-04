import { err, ok, type Result } from 'neverthrow'
import type { LedgerFailure } from './errors.ts'

const DAY = 86_400_000

/** Filter keys accepted in the search box, with the hint the autocomplete shows. */
export const FILTER_KEYS = [
  ['agent', 'written or read by an agent'],
  ['cluster', 'topic cluster'],
  ['type', 'chat or doc'],
  ['kind', 'claim or chunk'],
  ['strength', 'how much the store trusts it, e.g. strength:<40'],
  ['asof', 'knowledge as it stood on a date'],
  ['after', 'created after a date'],
  ['before', 'created before a date'],
] as const

export type FilterKey = (typeof FILTER_KEYS)[number][0]

const KEY_SET = new Set<string>(FILTER_KEYS.map(([k]) => k))

/** `strength:<40` / `strength:>70` — expressed 0..100 in the query, 0..1 internally. */
export type StrengthBound = { readonly op: '<' | '>'; readonly value: number }

export type ParsedQuery = {
  /** Free-text terms, lowercased. */
  readonly terms: readonly string[]
  readonly agent: readonly string[]
  readonly cluster: readonly string[]
  readonly type: readonly string[]
  readonly kind: readonly string[]
  readonly strength: StrengthBound | null
  /**
   * Time travel. `asof` is the interesting one: it asks what the store knew on
   * a date, so it must also resurrect memories dropped since — which is why
   * deletes are soft.
   */
  readonly asOf: number | null
  readonly before: number | null
  readonly after: number | null
}

const EMPTY: ParsedQuery = {
  terms: [],
  agent: [],
  cluster: [],
  type: [],
  kind: [],
  strength: null,
  asOf: null,
  before: null,
  after: null,
}

const RELATIVE_UNITS = { d: 1, w: 7, mo: 30.4, y: 365 } as const

/**
 * `30d`, `2w`, `6mo`, `1y` relative to now, or anything `Date.parse` accepts.
 * Returns null for unparseable input so the caller can report the bad token.
 */
export const parseDate = (input: string, now: number): number | null => {
  const relative = input.match(/^(\d+)(d|w|mo|y)$/)
  if (relative) {
    const [, amount, unit] = relative
    if (amount === undefined || unit === undefined) return null
    return now - Number(amount) * RELATIVE_UNITS[unit as keyof typeof RELATIVE_UNITS] * DAY
  }
  const parsed = Date.parse(input)
  return Number.isNaN(parsed) ? null : parsed
}

const parseStrength = (raw: string): StrengthBound | null => {
  const match = raw.match(/^([<>])\s*(\d{1,3})$/)
  if (!match) return null
  const [, op, value] = match
  if (op === undefined || value === undefined) return null
  const n = Number(value)
  if (n > 100) return null
  return { op: op as '<' | '>', value: n / 100 }
}

/**
 * Split a query string into free text and filters.
 *
 * Repeating a key widens rather than narrows — `agent:wren agent:forge` means
 * either agent, which is what someone typing it expects.
 */
export const parseQuery = (input: string, now: number): Result<ParsedQuery, LedgerFailure> => {
  const draft = {
    terms: [] as string[],
    agent: [] as string[],
    cluster: [] as string[],
    type: [] as string[],
    kind: [] as string[],
    strength: null as StrengthBound | null,
    asOf: null as number | null,
    before: null as number | null,
    after: null as number | null,
  }

  for (const token of input.trim().split(/\s+/)) {
    if (!token) continue
    const colon = token.indexOf(':')
    const key = colon > 0 ? token.slice(0, colon).toLowerCase() : null

    if (key === null || !KEY_SET.has(key)) {
      draft.terms.push(token.toLowerCase())
      continue
    }

    const value = token.slice(colon + 1)
    if (!value) continue // `agent:` mid-type — a prefix, not an error

    const filter: FilterKey = key as FilterKey
    switch (filter) {
      case 'agent':
      case 'cluster':
      case 'type':
      case 'kind':
        draft[filter].push(value.toLowerCase())
        break
      case 'strength': {
        const bound = parseStrength(value)
        if (!bound) {
          return err({
            kind: 'invalid-query',
            token,
            reason: 'expected strength:<N or strength:>N, N between 0 and 100',
          })
        }
        draft.strength = bound
        break
      }
      case 'asof':
      case 'before':
      case 'after': {
        const date = parseDate(value, now)
        if (date === null) {
          return err({
            kind: 'invalid-query',
            token,
            reason: 'expected a date like 2026-01-01 or a span like 30d, 2w, 6mo, 1y',
          })
        }
        if (filter === 'asof') draft.asOf = date
        else if (filter === 'before') draft.before = date
        else draft.after = date
        break
      }
    }
  }

  return ok({ ...EMPTY, ...draft })
}

/** True when the query asks for a moment other than now. */
export const isTimeTravel = (q: ParsedQuery): boolean => q.asOf !== null
