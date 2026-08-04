import type { Memory, SearchHit } from '@ledger/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type SearchResponse } from '../api.ts'
import { type FilterControls, Filters } from '../components/Filters.tsx'
import { Inspector } from '../components/Inspector.tsx'
import { agentColor, ago, fmtN, initial, oneLine, strengthColor } from '../format.ts'
import { useLoad } from '../hooks.ts'

/**
 * Browse — everything in the store, filterable and operable in bulk.
 *
 * The filter rail is shared with the canvas: narrowing here is still narrowed
 * there, because both are views of the same question rather than two apps.
 */

export type BrowseProps = {
  controls: FilterControls
  results: SearchResponse | null
  loading: boolean
  reload: () => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  onError: (error: unknown) => void
  sort: string
  dir: 'asc' | 'desc'
  onSort: (column: string) => void
}

const BULK_OPS = [
  { op: 'pin', label: 'PIN', hint: 'hold at full strength, exempt from decay' },
  {
    op: 'merge',
    label: 'MERGE',
    hint: 'fold into the first, summing evidence',
  },
  {
    op: 'archive',
    label: 'ARCHIVE',
    hint: 'hide from search without dropping',
  },
  { op: 'export', label: 'EXPORT', hint: 'download as JSONL' },
  { op: 'drop', label: 'DROP', hint: 'remove — still answerable by asof:' },
] as const

export const Browse = ({
  controls,
  results,
  loading,
  reload,
  notify,
  onError,
  sort,
  dir,
  onSort,
}: BrowseProps) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [focusId, setFocusId] = useState<string | null>(null)

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
    async (op: (typeof BULK_OPS)[number]['op']) => {
      const ids = [...selected]
      if (ids.length === 0) return
      try {
        if (op === 'export') {
          await api.exportJsonl(ids)
          notify(`exported ${ids.length} → ledger-export.jsonl`)
          return
        }
        if (op === 'merge' && ids.length < 2) {
          notify('select at least two to merge', 'error')
          return
        }
        await api.bulk(op, ids)
        notify(
          op === 'pin'
            ? `pinned ${ids.length} — protected from decay`
            : op === 'merge'
              ? `merged ${ids.length} → 1 · evidence summed`
              : op === 'drop'
                ? `dropped ${ids.length}`
                : `archived ${ids.length}`,
        )
        setSelected(new Set())
        reload()
      } catch (error) {
        onError(error)
      }
    },
    [selected, notify, onError, reload],
  )

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const mark = (column: string): string => (sort === column ? (dir === 'desc' ? '↓' : '↑') : '')

  return (
    <div className="screen" style={{ flexDirection: 'row' }}>
      <Filters controls={controls} />

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
            <div className="table__flags">FLAGS</div>
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
              <div className="table__flags">
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
