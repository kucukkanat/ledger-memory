import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { FacetsResponse, StatsResponse } from '../api.ts'
import {
  clearFilters,
  countFilters,
  type FilterFlags,
  hasFilter,
  type MemoryKind,
  toggleFilter,
} from '../filters.ts'
import { fmtN } from '../format.ts'

/**
 * The filter rail — the same one on every screen that shows memories.
 *
 * Facets write into the query string rather than into separate state. One
 * source of truth means the search box always describes exactly what you are
 * looking at, whether that is a table or a drawing, and a filter narrowed on
 * Browse is still narrowed when you switch to Canvas.
 */

export type FilterControls = {
  readonly query: string
  readonly onQuery: (next: string) => void
  readonly facets: FacetsResponse | null
  readonly stats: StatsResponse | null
  readonly kind: MemoryKind
  readonly onKind: (kind: MemoryKind) => void
  /**
   * Flags the query language deliberately does not express.
   *
   * "Pinned", "in conflict", "not yet reviewed" and "archived" are properties
   * of supervision, not of what a memory says — an agent has no business
   * filtering on them, so they live as API parameters and as checkboxes here
   * rather than as tokens in a DSL shared with agents.
   */
  readonly flags: FilterFlags
  readonly onFlag: (flag: keyof FilterFlags) => void
}

export type FiltersProps = {
  controls: FilterControls
  /** Filters only one screen has — the canvas' strength and reads floors. */
  extra?: ReactNode
  /** Cleared by RESET along with the query's facet tokens. */
  onReset?: () => void
}

const KINDS: readonly [MemoryKind, string][] = [
  ['all', 'everything'],
  ['claim', 'claims only'],
  ['chunk', 'document chunks'],
]

const FLAGS: readonly [keyof FilterFlags, string][] = [
  ['pinned', 'pinned'],
  ['conflicted', 'in conflict'],
  ['pending', 'not yet reviewed'],
  ['archived', 'archived'],
]

export const Filters = ({ controls, extra, onReset }: FiltersProps) => {
  const { query, onQuery, facets, stats, kind, onKind, flags, onFlag } = controls
  const [open, setOpen] = useState(true)

  const groups = useMemo(() => {
    if (!facets || !stats) return []
    const clusterLabels = new Map(stats.clusters.map((c) => [c.id, c.label]))
    return [
      {
        label: 'TYPE',
        key: 'type',
        items: facets.origin.map((o) => ({
          value: o.origin,
          label: o.origin === 'doc' ? 'from a document' : 'said in conversation',
          n: o.n,
        })),
      },
      {
        label: 'CLUSTER',
        key: 'cluster',
        items: facets.cluster
          .map((c) => ({
            value: c.cluster_id,
            label: clusterLabels.get(c.cluster_id) ?? c.cluster_id,
            n: c.n,
          }))
          .sort((a, b) => b.n - a.n),
      },
      {
        label: 'AGENT',
        key: 'agent',
        items: facets.agent
          .map((a) => ({ value: a.agent_id, label: a.agent_id, n: a.n }))
          .sort((a, b) => b.n - a.n),
      },
    ]
  }, [facets, stats])

  const active = countFilters(query, flags)

  if (!open) {
    return (
      <button
        type="button"
        className="facets facets--collapsed"
        onClick={() => setOpen(true)}
        title="show filters"
      >
        <span className="facets__toggle">»</span>
        <span className="eyebrow" style={{ writingMode: 'vertical-rl' }}>
          FILTERS
        </span>
        {active > 0 && (
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: 'var(--lg-bg)',
              background: 'var(--lg-accent)',
              padding: '1px 4px',
              borderRadius: 2,
            }}
          >
            {active}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="facets">
      <div className="facets__head">
        <button
          type="button"
          className="facets__toggle"
          onClick={() => setOpen(false)}
          title="hide filters"
        >
          «
        </button>
        <span className="eyebrow" style={{ flex: 1 }}>
          FILTERS
        </span>
        <button
          type="button"
          className="selbar__link"
          onClick={() => {
            onQuery(clearFilters(query))
            for (const [flag] of FLAGS) if (flags[flag]) onFlag(flag)
            onReset?.()
          }}
        >
          RESET
        </button>
      </div>

      <div className="facets__group eyebrow">KIND</div>
      {KINDS.map(([value, label]) => (
        <button
          type="button"
          key={value}
          className={`facets__item${kind === value ? ' facets__item--on' : ''}`}
          onClick={() => onKind(value)}
        >
          <span
            className="facets__mark"
            style={{
              borderRadius: '50%',
              borderColor: kind === value ? 'var(--lg-accent)' : 'var(--lg-text-ghost)',
              background: kind === value ? 'var(--lg-accent)' : 'transparent',
            }}
          />
          <span className="facets__label">{label}</span>
          <span className="facets__n">
            {value === 'claim'
              ? fmtN(stats?.claims ?? 0)
              : value === 'chunk'
                ? fmtN(stats?.chunks ?? 0)
                : fmtN(stats?.memories ?? 0)}
          </span>
        </button>
      ))}

      {groups.map((group) => (
        <div key={group.key}>
          <div className="facets__group eyebrow">{group.label}</div>
          {group.items.map((item) => {
            const on = hasFilter(query, group.key, item.value)
            return (
              <button
                type="button"
                key={item.value}
                className={`facets__item${on ? ' facets__item--on' : ''}`}
                onClick={() => onQuery(toggleFilter(query, group.key, item.value))}
              >
                <span
                  className="facets__mark"
                  style={{
                    borderColor: on ? 'var(--lg-accent)' : 'var(--lg-text-ghost)',
                    background: on ? 'var(--lg-accent)' : 'transparent',
                  }}
                />
                <span className="facets__label" style={on ? { color: 'var(--lg-text)' } : {}}>
                  {item.label}
                </span>
                <span className="facets__n">{fmtN(item.n)}</span>
              </button>
            )
          })}
        </div>
      ))}

      <div className="facets__group eyebrow">FLAGS</div>
      {FLAGS.map(([flag, label]) => (
        <button
          type="button"
          key={flag}
          className={`facets__item${flags[flag] ? ' facets__item--on' : ''}`}
          onClick={() => onFlag(flag)}
        >
          <span
            className="facets__mark"
            style={{
              borderRadius: 0,
              borderColor: flags[flag] ? 'var(--lg-accent)' : 'var(--lg-text-ghost)',
              background: flags[flag] ? 'var(--lg-accent)' : 'transparent',
            }}
          />
          <span className="facets__label" style={flags[flag] ? { color: 'var(--lg-text)' } : {}}>
            {label}
          </span>
          <span className="facets__n">{fmtN(facets?.flags[flag] ?? 0)}</span>
        </button>
      ))}

      {extra}
    </div>
  )
}
