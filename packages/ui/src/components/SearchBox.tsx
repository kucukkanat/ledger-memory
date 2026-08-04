import type { SearchMode } from '@ledger/core'
import { useMemo, useRef, useState } from 'react'
import type { FacetsResponse, StatsResponse } from '../api.ts'
import { fmtN } from '../format.ts'

/**
 * The search box and its filter autocomplete.
 *
 * Suggestions come from what is actually in the store — real clusters, real
 * agents, with counts — so the box teaches the query language by showing what
 * it can answer rather than by documenting itself.
 */

type Suggestion = {
  token: string
  hint: string
  count: string
  /** Whether accepting it completes a filter (append a space) or just a key. */
  complete: boolean
}

const KEYS: readonly (readonly [string, string])[] = [
  ['agent', 'written or read by an agent'],
  ['cluster', 'topic cluster'],
  ['type', 'chat or doc'],
  ['kind', 'claim or chunk'],
  ['strength', 'how much the store trusts it, e.g. strength:<40'],
  ['asof', 'knowledge as it stood on a date'],
  ['after', 'created after a date'],
  ['before', 'created before a date'],
]

const STRENGTH_VALUES: readonly (readonly [string, string])[] = [
  ['<20', 'all but forgotten'],
  ['<40', 'fading'],
  ['>70', 'strong'],
  ['>90', 'load-bearing'],
]

const dateValues = (kind: 'asof' | 'after' | 'before'): readonly (readonly [string, string])[] => {
  if (kind === 'asof') {
    return [
      ['2026-06-01', 'as it stood in June'],
      ['2026-01-01', 'as it stood at the start of 2026'],
      ['2025-09-01', 'as it stood in autumn 2025'],
    ]
  }
  const direction = kind === 'after' ? 'last' : 'older than'
  return [
    ['30d', `${direction} 30 days`],
    ['90d', `${direction} a quarter`],
    ['1y', `${direction} a year`],
    ['2026-01-01', kind === 'after' ? 'since the start of 2026' : 'before the start of 2026'],
  ]
}

const suggest = (
  query: string,
  facets: FacetsResponse | null,
  stats: StatsResponse | null,
): Suggestion[] => {
  const token = query.slice(query.lastIndexOf(' ') + 1)
  const colon = token.indexOf(':')

  if (colon < 0) {
    if (!token) return []
    const low = token.toLowerCase()
    return KEYS.filter(([key]) => key.startsWith(low) && key !== low).map(([key, hint]) => ({
      token: `${key}:`,
      hint,
      count: '',
      complete: false,
    }))
  }

  const key = token.slice(0, colon).toLowerCase()
  const value = token.slice(colon + 1).toLowerCase()
  if (!KEYS.some(([k]) => k === key)) return []

  const clusterCounts = new Map(facets?.cluster.map((c) => [c.cluster_id, c.n]) ?? [])
  const agentCounts = new Map(facets?.agent.map((a) => [a.agent_id, a.n]) ?? [])
  const originCounts = new Map(facets?.origin.map((o) => [o.origin, o.n]) ?? [])

  const rows: [string, string, number | null][] =
    key === 'cluster'
      ? (stats?.clusters ?? []).map((c) => [c.id, c.label, clusterCounts.get(c.id) ?? 0])
      : key === 'agent'
        ? [...agentCounts].map(([id, n]) => [id, '', n])
        : key === 'type'
          ? [
              ['chat', 'said in conversation', originCounts.get('chat') ?? 0],
              ['doc', 'from a document', originCounts.get('doc') ?? 0],
            ]
          : key === 'kind'
            ? [
                ['claim', 'an assertion', stats?.claims ?? 0],
                ['chunk', 'a slice of a document', stats?.chunks ?? 0],
              ]
            : key === 'strength'
              ? STRENGTH_VALUES.map(([v, hint]) => [v, hint, null])
              : dateValues(key as 'asof' | 'after' | 'before').map(([v, hint]) => [v, hint, null])

  return rows
    .filter(([v]) => v.toLowerCase().startsWith(value))
    .slice(0, 8)
    .map(([v, hint, count]) => ({
      token: `${key}:${v}`,
      hint,
      count: count === null ? '' : fmtN(count),
      complete: true,
    }))
}

export type SearchBoxProps = {
  value: string
  onChange: (next: string) => void
  mode: SearchMode
  onMode: () => void
  facets: FacetsResponse | null
  stats: StatsResponse | null
  resultLine: string
}

export const SearchBox = ({
  value,
  onChange,
  mode,
  onMode,
  facets,
  stats,
  resultLine,
}: SearchBoxProps) => {
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const items = useMemo(() => suggest(value, facets, stats), [value, facets, stats])
  const open = focused && !dismissed && items.length > 0

  const accept = (item: Suggestion): void => {
    const space = value.lastIndexOf(' ')
    const prefix = space < 0 ? '' : value.slice(0, space + 1)
    onChange(prefix + item.token + (item.complete ? ' ' : ''))
    setActive(0)
    input.current?.focus()
  }

  return (
    <div className="searchbox">
      <div className="searchbox__field">
        <span className="mono accent" style={{ fontSize: 10, letterSpacing: '0.1em' }}>
          ⌕
        </span>
        <input
          ref={input}
          className="searchbox__input"
          value={value}
          placeholder="search memories — or agent:forge cluster:code asof:2026-01-01"
          onChange={(e) => {
            onChange(e.target.value)
            setDismissed(false)
            setActive(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              const item = items[active]
              if (item) {
                e.preventDefault()
                accept(item)
              }
            } else if (e.key === 'Escape') {
              setDismissed(true)
            }
          }}
        />
        <button
          type="button"
          className="searchbox__mode"
          onClick={onMode}
          title="search mode — hybrid widens keyword matching with character-level fuzz"
        >
          {mode.toUpperCase()}
        </button>
      </div>

      {open && (
        <div className="searchbox__menu">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.token}
              className={`searchbox__item${index === active ? ' searchbox__item--active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                accept(item)
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="searchbox__token">{item.token}</span>
              <span className="searchbox__hint">{item.hint}</span>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--lg-text-trace)' }}>
                {item.count}
              </span>
            </button>
          ))}
          <div className="searchbox__foot">↑↓ MOVE · ⏎ ACCEPT · ESC DISMISS</div>
        </div>
      )}

      {!open && resultLine && (
        <span
          className="mono"
          style={{
            position: 'absolute',
            right: -12,
            top: 7,
            transform: 'translateX(100%)',
            fontSize: 10.5,
            color: 'var(--lg-text-faint)',
            whiteSpace: 'nowrap',
          }}
        >
          {resultLine}
        </span>
      )}
    </div>
  )
}
