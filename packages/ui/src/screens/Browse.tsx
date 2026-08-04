import type { Memory, SearchHit } from '@ledger/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type FacetsResponse, type SearchResponse, type StatsResponse } from '../api.ts'
import { Inspector } from '../components/Inspector.tsx'
import { agentColor, ago, fmtN, initial, oneLine, strengthColor } from '../format.ts'
import { useLoad } from '../hooks.ts'

/**
 * Browse — everything in the store, filterable and operable in bulk.
 *
 * Facets here write into the query string rather than into separate state.
 * One source of truth means the URL-ish query in the search box always
 * describes exactly what the table is showing, and a filter clicked in the
 * sidebar is a filter you can then read, edit or copy.
 */

export type BrowseProps = {
  query: string
  onQuery: (next: string) => void
  facets: FacetsResponse | null
  stats: StatsResponse | null
  results: SearchResponse | null
  loading: boolean
  reload: () => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  onError: (error: unknown) => void
  sort: string
  dir: 'asc' | 'desc'
  onSort: (column: string) => void
  kind: 'claim' | 'chunk' | 'all'
  onKind: (kind: 'claim' | 'chunk' | 'all') => void
  /**
   * Flags the query language deliberately does not express.
   *
   * "Pinned", "in conflict", "not yet reviewed" and "archived" are properties
   * of supervision, not of what a memory says — an agent has no business
   * filtering on them, so they live as API parameters and as checkboxes here
   * rather than as tokens in a DSL shared with agents.
   */
  flags: BrowseFlags
  onFlag: (flag: keyof BrowseFlags) => void
}

export type BrowseFlags = {
  pinned: boolean
  conflicted: boolean
  pending: boolean
  archived: boolean
}

/** Add or remove a `key:value` token in the query string. */
const toggleFilter = (query: string, key: string, value: string): string => {
  const token = `${key}:${value}`
  const parts = query.split(/\s+/).filter(Boolean)
  const without = parts.filter((p) => p.toLowerCase() !== token.toLowerCase())
  return (without.length === parts.length ? [...parts, token] : without).join(' ')
}

const hasFilter = (query: string, key: string, value: string): boolean =>
  query.split(/\s+/).some((p) => p.toLowerCase() === `${key}:${value}`.toLowerCase())

const BULK_OPS = [
  { op: 'pin', label: 'PIN', hint: 'hold at full strength, exempt from decay' },
  {
    op: 'merge',
    label: 'MERGE',
    hint: 'fold into the first, summing evidence',
  },
  { op: 'tag', label: 'TAG', hint: 'apply a tag to everything selected' },
  {
    op: 'archive',
    label: 'ARCHIVE',
    hint: 'hide from search without dropping',
  },
  { op: 'export', label: 'EXPORT', hint: 'download as JSONL' },
  { op: 'drop', label: 'DROP', hint: 'remove — still answerable by asof:' },
] as const

export const Browse = ({
  query,
  onQuery,
  facets,
  stats,
  results,
  loading,
  reload,
  notify,
  onError,
  sort,
  dir,
  onSort,
  kind,
  onKind,
  flags,
  onFlag,
}: BrowseProps) => {
  const [facetsOpen, setFacetsOpen] = useState(true)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [tagOpen, setTagOpen] = useState(false)
  const [newTag, setNewTag] = useState('')

  const rows = useMemo(() => results?.hits ?? [], [results])
  const detail = useLoad(
    () => (focusId ? api.memory(focusId) : Promise.resolve(null)),
    [focusId],
    onError,
  )

  // A row that has been dropped or filtered away should not keep the panel open.
  useEffect(() => {
    if (focusId && rows.length > 0 && !rows.some((r) => r.id === focusId)) setFocusId(null)
  }, [rows, focusId])

  const toggleRow = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const runBulk = useCallback(
    async (op: (typeof BULK_OPS)[number]['op'], tag?: string) => {
      const ids = [...selected]
      if (ids.length === 0) return
      try {
        if (op === 'export') {
          await api.exportJsonl(ids)
          notify(`exported ${ids.length} → ledger-export.jsonl`)
          return
        }
        if (op === 'tag' && !tag) {
          setTagOpen((open) => !open)
          return
        }
        if (op === 'merge' && ids.length < 2) {
          notify('select at least two to merge', 'error')
          return
        }
        await api.bulk(op, ids, tag)
        notify(
          op === 'pin'
            ? `pinned ${ids.length} — protected from decay`
            : op === 'merge'
              ? `merged ${ids.length} → 1 · evidence summed`
              : op === 'tag'
                ? `tagged ${ids.length} as "${tag}"`
                : op === 'drop'
                  ? `dropped ${ids.length}`
                  : `archived ${ids.length}`,
        )
        setSelected(new Set())
        setTagOpen(false)
        setNewTag('')
        reload()
      } catch (error) {
        onError(error)
      }
    },
    [selected, notify, onError, reload],
  )

  const facetGroups = useMemo(() => {
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
      {
        label: 'TAG',
        key: 'tag',
        items: facets.tag.slice(0, 12).map((t) => ({ value: t.tag, label: t.tag, n: t.n })),
      },
    ]
  }, [facets, stats])

  const activeFacets = query.split(/\s+/).filter((p) => p.includes(':')).length
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const mark = (column: string): string => (sort === column ? (dir === 'desc' ? '↓' : '↑') : '')

  return (
    <div className="screen" style={{ flexDirection: 'row' }}>
      {facetsOpen ? (
        <div className="facets">
          <div className="facets__head">
            <button
              type="button"
              className="facets__toggle"
              onClick={() => setFacetsOpen(false)}
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
              onClick={() =>
                onQuery(
                  query
                    .split(/\s+/)
                    .filter((p) => !p.includes(':'))
                    .join(' '),
                )
              }
            >
              RESET
            </button>
          </div>

          <div className="facets__group eyebrow">KIND</div>
          {(
            [
              ['all', 'everything'],
              ['claim', 'claims only'],
              ['chunk', 'document chunks'],
            ] as const
          ).map(([value, label]) => (
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

          {facetGroups.map((group) => (
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
          {(
            [
              ['pinned', 'pinned', facets?.flags.pinned ?? 0],
              ['conflicted', 'in conflict', facets?.flags.conflicted ?? 0],
              ['pending', 'not yet reviewed', facets?.flags.pending ?? 0],
              ['archived', 'archived', facets?.flags.archived ?? 0],
            ] as const
          ).map(([flag, label, n]) => (
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
              <span
                className="facets__label"
                style={flags[flag] ? { color: 'var(--lg-text)' } : {}}
              >
                {label}
              </span>
              <span className="facets__n">{fmtN(n)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="facets facets--collapsed"
          onClick={() => setFacetsOpen(true)}
          title="show filters"
        >
          <span className="facets__toggle">»</span>
          <span className="eyebrow" style={{ writingMode: 'vertical-rl' }}>
            FILTERS
          </span>
          {activeFacets > 0 && (
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
              {activeFacets}
            </span>
          )}
        </button>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {selected.size > 0 && (
          <div className="selbar">
            <span className="selbar__count">{selected.size} selected</span>
            <button
              type="button"
              className="selbar__link"
              onClick={() => setSelected(new Set(rows.map((r) => r.id)))}
            >
              select all {fmtN(rows.length)}
            </button>
            <span
              style={{
                width: 1,
                height: 16,
                background: 'var(--lg-accent-border)',
              }}
            />
            {BULK_OPS.map((op) => (
              <button
                type="button"
                key={op.op}
                className={`btn${op.op === 'drop' ? ' btn--danger' : ''}`}
                title={op.hint}
                onClick={() => void runBulk(op.op)}
              >
                {op.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button type="button" className="selbar__link" onClick={() => setSelected(new Set())}>
              CLEAR ✕
            </button>
          </div>
        )}

        {tagOpen && (
          <div className="tagbar">
            <span className="eyebrow">APPLY TAG</span>
            {(facets?.tags ?? []).slice(0, 14).map((tag) => (
              <button
                type="button"
                key={tag}
                className="btn"
                onClick={() => void runBulk('tag', tag)}
              >
                {tag}
              </button>
            ))}
            <input
              className="tagbar__input"
              value={newTag}
              placeholder="new tag ⏎"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) void runBulk('tag', newTag.trim())
              }}
            />
          </div>
        )}

        <div className="table">
          <div className="table__head">
            <button
              type="button"
              className="table__check"
              onClick={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
            >
              {allChecked ? '◼' : '◻'}
            </button>
            <div className="table__src">SRC</div>
            <div style={{ flex: 1, minWidth: 240 }}>MEMORY</div>
            <div style={{ width: 118, flex: 'none' }}>CLUSTER</div>
            <div style={{ width: 72, flex: 'none' }}>AGENTS</div>
            <div style={{ width: 80, flex: 'none' }}>
              <button
                type="button"
                onClick={() => onSort('strength')}
                title="how much the store trusts this memory"
              >
                STRENGTH {mark('strength')}
              </button>
            </div>
            <div className="table__num" style={{ width: 52 }}>
              <button type="button" onClick={() => onSort('hits')}>
                HITS {mark('hits')}
              </button>
            </div>
            <div className="table__num" style={{ width: 64 }}>
              <button type="button" onClick={() => onSort('last')}>
                SEEN {mark('last')}
              </button>
            </div>
            <div className="table__tags">TAGS</div>
          </div>

          {rows.map((row: SearchHit) => (
            // A real <button> cannot contain the row's selection checkbox —
            // nested interactive elements are invalid — so the row takes button
            // semantics via role instead.
            // biome-ignore lint/a11y/useSemanticElements: row contains a nested checkbox button
            <div
              key={row.id}
              className={`table__row${focusId === row.id ? ' table__row--focus' : ''}${
                selected.has(row.id) ? ' table__row--selected' : ''
              }`}
              onClick={() => setFocusId(row.id)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  setFocusId(row.id)
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={focusId === row.id}
              aria-label={`Inspect: ${oneLine(row.text)}`}
            >
              <button
                type="button"
                className="table__check"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleRow(row.id)
                }}
                style={selected.has(row.id) ? { color: 'var(--lg-accent)' } : {}}
              >
                {selected.has(row.id) ? '◼' : '◻'}
              </button>
              <div
                className="table__src"
                style={{
                  color: row.kind === 'chunk' ? '#9a76dd' : 'var(--lg-text-ghost)',
                }}
              >
                {row.kind === 'chunk' ? 'DOC' : row.origin === 'doc' ? 'DIST' : 'CHAT'}
              </div>
              <div
                className="table__text"
                style={row.reviewedAt === null ? { color: 'var(--lg-text)' } : {}}
              >
                {oneLine(row.text)}
              </div>
              <div className="table__cluster">
                <span
                  className="dot"
                  style={{ width: 6, height: 6, background: row.clusterColor }}
                />
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.clusterLabel}
                </span>
              </div>
              <div className="table__agents">
                {row.readers.slice(0, 3).map((reader) => (
                  <span
                    key={reader}
                    className="badge"
                    title={reader}
                    style={{
                      width: 14,
                      height: 14,
                      background: `${agentColor(reader)}22`,
                      color: agentColor(reader),
                    }}
                  >
                    {initial(reader)}
                  </span>
                ))}
              </div>
              <div className="table__strength">
                <div className="meter">
                  <div
                    className="meter__fill"
                    style={{
                      width: `${row.strength * 100}%`,
                      background: strengthColor(row.strength),
                    }}
                  />
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    color: 'var(--lg-text-faint)',
                    width: 18,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(row.strength * 100)}
                </span>
              </div>
              <div className="table__num" style={{ width: 52 }}>
                {fmtN(row.hits)}
              </div>
              <div className="table__num" style={{ width: 64 }}>
                {ago(row.lastReadAt)}
              </div>
              <div className="table__tags">
                {row.tags.slice(0, 2).map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
                {row.pinned && (
                  <span className="accent" title="pinned" style={{ fontSize: 10 }}>
                    ◆
                  </span>
                )}
                {row.conflictWith && (
                  <span className="warn" title="in conflict" style={{ fontSize: 10 }}>
                    ▲
                  </span>
                )}
              </div>
            </div>
          ))}

          <div className="table__foot">
            {loading
              ? 'SEARCHING…'
              : rows.length === 0
                ? 'NOTHING MATCHES'
                : results?.capped
                  ? `SHOWING ${fmtN(rows.length)} — MORE MATCHED THAN COULD BE RANKED, NARROW THE QUERY`
                  : `${fmtN(results?.total ?? 0)} MEMORIES · ${Math.round(results?.tookMs ?? 0)}MS`}
          </div>
        </div>
      </div>

      {detail.data && (
        <Inspector
          memory={detail.data.memory}
          related={detail.data.related}
          onClose={() => setFocusId(null)}
          onPin={() => {
            const memory: Memory = detail.data?.memory as Memory
            void api
              .bulk(memory.pinned ? 'unpin' : 'pin', [memory.id])
              .then(() => {
                notify(memory.pinned ? 'unpinned' : 'pinned — protected from decay')
                detail.reload()
                reload()
              })
              .catch(onError)
          }}
          onDrop={() => {
            const id = detail.data?.memory.id
            if (!id) return
            void api
              .bulk('drop', [id])
              .then(() => {
                notify('dropped — still answerable by asof:')
                setFocusId(null)
                reload()
              })
              .catch(onError)
          }}
          onOpen={setFocusId}
        />
      )}
    </div>
  )
}
