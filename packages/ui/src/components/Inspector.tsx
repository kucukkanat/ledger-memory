import type { Memory } from '@ledger/core'
import { agentColor, ago, dateStr, fmtN, initial, pct, strengthColor } from '../format.ts'

/**
 * The memory inspector.
 *
 * Its job is to explain *why* a memory has the strength it has. A bare number
 * is unarguable; the three factors behind it are something a person can
 * disagree with, which is the point of a supervision UI.
 */

export type InspectorProps = {
  memory: Memory
  related: Memory[]
  onClose: () => void
  onPin: () => void
  onDrop: () => void
  onOpen: (id: string) => void
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="inspector__row">
    <span>{label}</span>
    <span>{value}</span>
  </div>
)

export const Inspector = ({ memory, related, onClose, onPin, onDrop, onOpen }: InspectorProps) => {
  const isChunk = memory.kind === 'chunk'
  const strength = Math.round(memory.strength * 100)

  const kindLabel = isChunk
    ? 'document chunk'
    : memory.sourceId
      ? 'claim · distilled from a document'
      : 'claim · from conversation'

  const decayNote = isChunk
    ? 'Chunks inherit the trust of their source. They do not decay and are never reviewed one by one.'
    : memory.pinned
      ? 'Pinned — held at full strength regardless of use.'
      : 'Recomputed on every read from the three signals above.'

  const factors: { label: string; value: number; hint: string }[] = [
    {
      label: 'used',
      value: memory.factors.used,
      hint: `${fmtN(memory.hits)} reads`,
    },
    {
      label: 'fresh',
      value: memory.factors.fresh,
      hint: `${ago(memory.lastReadAt)} ago`,
    },
    {
      label: 'corroborated',
      value: memory.factors.corroborated,
      hint: `${memory.sourceCount} src · ${memory.readers.length} agents`,
    },
  ]

  return (
    <div className="inspector">
      <div className="inspector__head">
        <span className="eyebrow">{memory.id.slice(-8)}</span>
        <button type="button" className="btn" onClick={onClose} title="close">
          ✕
        </button>
      </div>

      <div className="inspector__body">
        <div className="inspector__text">{memory.text}</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div className="meter" style={{ height: 4 }}>
            <div
              className="meter__fill"
              style={{
                width: `${strength}%`,
                background: strengthColor(memory.strength),
              }}
            />
          </div>
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: strengthColor(memory.strength),
              width: 26,
            }}
          >
            {strength}
          </span>
        </div>

        <div className="eyebrow" style={{ marginBottom: 4 }}>
          Why this strength
        </div>
        {factors.map((factor) => (
          <div className="inspector__factor" key={factor.label}>
            <span className="inspector__factor-label">{factor.label}</span>
            <div className="meter">
              <div
                className="meter__fill"
                style={{
                  width: pct(factor.value),
                  background: 'var(--lg-accent)',
                }}
              />
            </div>
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                color: 'var(--lg-text-faint)',
                width: 84,
                textAlign: 'right',
              }}
            >
              {factor.hint}
            </span>
          </div>
        ))}
        <div className="inspector__note">{decayNote}</div>

        <div className="eyebrow" style={{ margin: '18px 0 4px' }}>
          Provenance
        </div>
        <Row label="kind" value={kindLabel} />
        <Row label="cluster" value={memory.clusterLabel} />
        <Row label="written by" value={memory.writer} />
        <Row label="created" value={dateStr(memory.createdAt)} />
        <Row label="last read" value={`${ago(memory.lastReadAt)} ago`} />
        <Row label="reads" value={fmtN(memory.hits)} />
        {memory.provenance && <div className="inspector__note">{memory.provenance}</div>}

        <div className="eyebrow" style={{ margin: '18px 0 6px' }}>
          Read by
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {memory.readers.map((reader) => (
            <span
              key={reader}
              className="badge"
              title={reader}
              style={{
                background: `${agentColor(reader)}22`,
                color: agentColor(reader),
              }}
            >
              {initial(reader)}
            </span>
          ))}
        </div>

        {related.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '18px 0 6px' }}>
              Related · {related.length}
            </div>
            {related.map((item) => (
              <button
                type="button"
                key={item.id}
                className="inspector__related"
                onClick={() => onOpen(item.id)}
              >
                {item.text}
              </button>
            ))}
          </>
        )}

        <div style={{ display: 'flex', gap: 5, marginTop: 20 }}>
          {!isChunk && (
            <button type="button" className="btn" onClick={onPin}>
              {memory.pinned ? 'UNPIN' : 'PIN'}
            </button>
          )}
          <button type="button" className="btn btn--danger" onClick={onDrop}>
            DROP
          </button>
        </div>
        {isChunk && (
          <div className="inspector__note">
            To remove this, drop its source on the Sources screen — chunks are not managed
            individually.
          </div>
        )}
      </div>
    </div>
  )
}
