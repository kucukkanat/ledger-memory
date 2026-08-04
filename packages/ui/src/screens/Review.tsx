import type { Conflict, ConflictResolution, Memory } from '@ledger/core'
import { useCallback, useEffect, useState } from 'react'
import { api, type ReviewResponse } from '../api.ts'
import { agentColor, ago, dateStr, initial, strengthColor } from '../format.ts'
import { useKeys } from '../hooks.ts'

/**
 * The Review screen — what your agents learned since you last looked.
 *
 * Two lanes, because the two decisions are different in kind. A new claim is
 * "is this right?". A conflict is "which of these two is right?", and answering
 * it retires a memory. Keyboard-first: the whole point is to clear a queue
 * quickly, and reaching for a mouse per item does not scale.
 */

export type ReviewProps = {
  data: ReviewResponse
  reload: () => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  onError: (error: unknown) => void
  clearedCount: number
}

const AgentBadge = ({ id }: { id: string }) => (
  <span
    className="badge"
    title={id}
    style={{ background: `${agentColor(id)}22`, color: agentColor(id) }}
  >
    {initial(id)}
  </span>
)

const ClaimCard = ({
  memory,
  selected,
  onSelect,
  onAct,
  editing,
  onEdit,
  onCommit,
}: {
  memory: Memory
  selected: boolean
  onSelect: () => void
  onAct: (action: 'keep' | 'pin' | 'drop') => void
  editing: boolean
  onEdit: () => void
  onCommit: (text: string) => void
}) => {
  const [draft, setDraft] = useState(memory.text)
  useEffect(() => setDraft(memory.text), [memory.text])

  return (
    <div
      className={`card${selected ? ' card--selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
    >
      <div className="card__meta">
        <AgentBadge id={memory.writer} />
        <span>{memory.writer}</span>
        <span className="dim">{ago(memory.createdAt)} ago</span>
        <span
          className="pill"
          style={{
            background: memory.origin === 'doc' ? '#9a76dd' : 'var(--lg-accent)',
          }}
        >
          {memory.origin === 'doc' ? 'DOC' : 'CHAT'}
        </span>
        <span className="dot" style={{ width: 6, height: 6, background: memory.clusterColor }} />
        <span className="dim">{memory.clusterLabel}</span>
        <span style={{ flex: 1 }} />
        <span className="dim" style={{ color: strengthColor(memory.strength) }}>
          str {Math.round(memory.strength * 100)}
        </span>
      </div>

      {editing ? (
        <input
          className="card__input"
          value={draft}
          // The user pressed E (or clicked EDIT) to get here; not focusing the
          // field they just asked for would be the accessibility failure.
          // biome-ignore lint/a11y/noAutofocus: focus follows an explicit edit request
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(draft)
            if (e.key === 'Escape') onCommit(memory.text)
          }}
          onBlur={() => onCommit(draft)}
        />
      ) : (
        <div className="card__text">{memory.text}</div>
      )}

      {memory.provenance && <div className="card__prov">{memory.provenance}</div>}

      <div className="card__actions">
        <button type="button" className="btn btn--accent" onClick={() => onAct('keep')}>
          KEEP <span className="btn__key">A</span>
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          EDIT <span className="btn__key">E</span>
        </button>
        <button type="button" className="btn" onClick={() => onAct('pin')}>
          PIN <span className="btn__key">P</span>
        </button>
        <button type="button" className="btn btn--danger" onClick={() => onAct('drop')}>
          DROP <span className="btn__key">D</span>
        </button>
      </div>
    </div>
  )
}

const ConflictCard = ({
  conflict,
  selected,
  onSelect,
  onResolve,
}: {
  conflict: Conflict
  selected: boolean
  onSelect: () => void
  onResolve: (resolution: ConflictResolution) => void
}) => (
  <div
    className={`conflict${selected ? ' conflict--selected' : ''}`}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onSelect()
      }
    }}
    role="option"
    aria-selected={selected}
    tabIndex={-1}
  >
    <div className="conflict__head">
      <span className="warn">▲</span>
      <span className="warn" style={{ letterSpacing: '0.1em' }}>
        {conflict.kind.toUpperCase()}
      </span>
      <span className="dim">{conflict.a.clusterLabel}</span>
      <span style={{ flex: 1 }} />
      <span
        className="dim"
        title="how sure the judging agent was that these really contradict"
        style={{ fontSize: 9.5 }}
      >
        detector {Math.round(conflict.detector * 100)}
      </span>
    </div>

    <div className="conflict__sides">
      {(
        [
          ['A', conflict.a],
          ['B', conflict.b],
        ] as const
      ).map(([slot, memory]) => (
        <div key={slot} className="conflict__side">
          <div className="conflict__slot">
            <span>{slot}</span>
            <AgentBadge id={memory.writer} />
            <span className="dim">{ago(memory.createdAt)} ago</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: strengthColor(memory.strength) }}>
              str {Math.round(memory.strength * 100)}
            </span>
          </div>
          <div className="conflict__text">{memory.text}</div>
          <div className="card__prov">
            {memory.provenance || `written ${dateStr(memory.createdAt)}`}
          </div>
        </div>
      ))}
    </div>

    {conflict.note && (
      <div className="card__prov" style={{ padding: '8px 15px 0' }}>
        {conflict.note}
      </div>
    )}

    <div className="conflict__actions">
      <button type="button" className="btn btn--accent" onClick={() => onResolve('a')}>
        KEEP A <span className="btn__key">1</span>
      </button>
      <button type="button" className="btn btn--accent" onClick={() => onResolve('b')}>
        KEEP B <span className="btn__key">2</span>
      </button>
      <button type="button" className="btn" onClick={() => onResolve('both')}>
        KEEP BOTH <span className="btn__key">B</span>
      </button>
      <button type="button" className="btn" onClick={() => onResolve('merge')}>
        MERGE <span className="btn__key">M</span>
      </button>
      <button type="button" className="btn" onClick={() => onResolve('dismiss')}>
        NOT A CONFLICT <span className="btn__key">N</span>
      </button>
    </div>
  </div>
)

export const Review = ({ data, reload, notify, onError, clearedCount }: ReviewProps) => {
  const [lane, setLane] = useState<'claims' | 'conflicts'>('claims')
  const [index, setIndex] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)

  const claims = data.claims
  const conflicts = data.conflicts
  const list: readonly (Memory | Conflict)[] = lane === 'claims' ? claims : conflicts
  const current = list[Math.min(index, list.length - 1)]

  useEffect(() => {
    if (lane === 'claims' && claims.length === 0 && conflicts.length > 0) setLane('conflicts')
    if (lane === 'conflicts' && conflicts.length === 0 && claims.length > 0) setLane('claims')
  }, [lane, claims.length, conflicts.length])

  // `lane` is the trigger, not an input: switching lane resets the cursor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lane is the trigger
  useEffect(() => setIndex(0), [lane])

  const act = useCallback(
    async (memory: Memory, action: 'keep' | 'pin' | 'drop') => {
      try {
        await api.reviewAction(memory.id, action)
        notify(
          action === 'keep'
            ? 'kept'
            : action === 'pin'
              ? 'kept and pinned — held at full strength'
              : 'dropped',
        )
        reload()
      } catch (error) {
        onError(error)
      }
    },
    [notify, onError, reload],
  )

  const resolve = useCallback(
    async (conflict: Conflict, resolution: ConflictResolution) => {
      try {
        await api.resolveConflict(conflict.id, resolution)
        notify(
          {
            a: 'kept A · 1 memory retired',
            b: 'kept B · 1 memory retired',
            both: 'both kept · linked as related, not contradictory',
            merge: 'merged — newer value kept, evidence preserved',
            dismiss: 'dismissed — detector marked wrong',
          }[resolution],
        )
        reload()
      } catch (error) {
        onError(error)
      }
    },
    [notify, onError, reload],
  )

  const commitEdit = useCallback(
    async (memory: Memory, text: string) => {
      setEditing(null)
      if (text.trim() === memory.text || !text.trim()) return
      try {
        await api.reviewEdit(memory.id, text.trim())
        notify('updated and kept')
        reload()
      } catch (error) {
        onError(error)
      }
    },
    [notify, onError, reload],
  )

  useKeys((key, event) => {
    if (!current) return
    if (key === 'ArrowDown' || key === 'j') {
      event.preventDefault()
      setIndex((i) => Math.min(i + 1, list.length - 1))
      return
    }
    if (key === 'ArrowUp' || key === 'k') {
      event.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
      return
    }
    if (key === 'Tab') {
      event.preventDefault()
      setLane((l) => (l === 'claims' ? 'conflicts' : 'claims'))
      return
    }

    if (lane === 'claims') {
      const memory = current as Memory
      if (key === 'a') void act(memory, 'keep')
      else if (key === 'd') void act(memory, 'drop')
      else if (key === 'p') void act(memory, 'pin')
      else if (key === 'e') {
        event.preventDefault()
        setEditing(memory.id)
      }
    } else {
      const conflict = current as Conflict
      const chosen = {
        '1': 'a',
        '2': 'b',
        b: 'both',
        m: 'merge',
        n: 'dismiss',
      }[key] as ConflictResolution | undefined
      if (chosen) void resolve(conflict, chosen)
    }
  }, editing === null)

  const total = claims.length + conflicts.length
  const progress = clearedCount + total === 0 ? 100 : (clearedCount / (clearedCount + total)) * 100

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <h1 className="screen__title">What your agents learned</h1>
          <div className="mono dim" style={{ fontSize: 10.5, marginTop: 3 }}>
            {total === 0
              ? 'queue clear'
              : `${total} waiting · ${data.candidates.length} pairs still with the agents`}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="tabs">
          {(
            [
              ['claims', 'CLAIMS', claims.length],
              ['conflicts', 'CONFLICTS', conflicts.length],
            ] as const
          ).map(([id, label, n]) => (
            <button
              type="button"
              key={id}
              className={`tabs__tab${lane === id ? ' tabs__tab--active' : ''}`}
              onClick={() => setLane(id)}
            >
              <span>{label}</span>
              <span style={{ opacity: 0.7 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="progress">
        <div className="progress__fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="queue">
        <div className="queue__list" role="listbox" aria-label="Review queue">
          {list.length === 0 ? (
            <div className="empty">
              <div
                className="mono accent"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  marginBottom: 12,
                }}
              >
                QUEUE CLEAR
              </div>
              <div
                className="muted"
                style={{
                  fontSize: 14.5,
                  maxWidth: 430,
                  margin: '0 auto',
                  lineHeight: 1.55,
                }}
              >
                Your agents are writing straight through. Everything they learn stays searchable
                whether or not you get to it — the queue is an audit, not a gate.
              </div>
            </div>
          ) : lane === 'claims' ? (
            claims.map((memory, i) => (
              <ClaimCard
                key={memory.id}
                memory={memory}
                selected={i === Math.min(index, claims.length - 1)}
                onSelect={() => setIndex(i)}
                onAct={(action) => void act(memory, action)}
                editing={editing === memory.id}
                onEdit={() => setEditing(memory.id)}
                onCommit={(text) => void commitEdit(memory, text)}
              />
            ))
          ) : (
            conflicts.map((conflict, i) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                selected={i === Math.min(index, conflicts.length - 1)}
                onSelect={() => setIndex(i)}
                onResolve={(resolution) => void resolve(conflict, resolution)}
              />
            ))
          )}
        </div>
      </div>

      <div className="keybar">
        <span>↑↓ MOVE</span>
        <span>TAB LANE</span>
        {lane === 'claims' ? (
          <>
            <span>
              <b>A</b> KEEP
            </span>
            <span>
              <b>E</b> EDIT
            </span>
            <span>
              <b className="danger">D</b> DROP
            </span>
            <span>
              <b>P</b> PIN
            </span>
          </>
        ) : (
          <>
            <span>
              <b>1</b>/<b>2</b> KEEP A/B
            </span>
            <span>
              <b>B</b> KEEP BOTH
            </span>
            <span>
              <b>M</b> MERGE
            </span>
            <span>
              <b style={{ color: 'var(--lg-text-dim)' }}>N</b> NOT A CONFLICT
            </span>
          </>
        )}
      </div>
    </div>
  )
}
