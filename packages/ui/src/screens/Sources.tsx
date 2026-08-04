import { useState } from 'react'
import { api, type SourceRow } from '../api.ts'
import { agentColor, ago, bytes, fmtN, initial, oneLine, strengthColor } from '../format.ts'

/**
 * Sources — the documents behind the chunks.
 *
 * The screen exists to make one rule visible: a document is trusted or dropped
 * whole. Its chunks follow it; the claims an agent distilled from it do not,
 * because a person already judged those worth keeping on their own terms.
 */

export type SourcesProps = {
  sources: SourceRow[]
  reload: () => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  onError: (error: unknown) => void
  onOpenMemory: (id: string) => void
}

export const Sources = ({ sources, reload, notify, onError, onOpenMemory }: SourcesProps) => {
  const [open, setOpen] = useState<string | null>(null)

  const totals = sources.reduce(
    (sum, s) => ({
      chunks: sum.chunks + s.chunkCount,
      claims: sum.claims + s.claimCount,
      size: sum.size + s.bytes,
    }),
    { chunks: 0, claims: 0, size: 0 },
  )

  const drop = async (source: SourceRow): Promise<void> => {
    try {
      const result = await api.dropSource(source.id)
      notify(
        `dropped ${source.filename} · ${result.chunks} chunks removed, ${result.flagged} claims flagged`,
      )
      setOpen(null)
      reload()
    } catch (error) {
      onError(error)
    }
  }

  const retrust = async (source: SourceRow, trust: number): Promise<void> => {
    try {
      await api.trustSource(source.id, trust)
      reload()
    } catch (error) {
      onError(error)
    }
  }

  return (
    <div className="screen screen--scroll">
      <div style={{ maxWidth: 1180 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <h1 className="screen__title">Sources</h1>
          <span className="mono dim" style={{ fontSize: 11 }}>
            {sources.length} documents · {fmtN(totals.chunks)} chunks · {fmtN(totals.claims)} claims
            distilled · {bytes(totals.size)}
          </span>
        </div>
        <div className="dim" style={{ fontSize: 13, marginBottom: 18, maxWidth: 660 }}>
          Documents are trusted or dropped whole. Their chunks stay searchable but never enter the
          review queue — only the claims an agent distils from them do.
        </div>

        <div className="sources__head">
          <div style={{ width: 16, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>DOCUMENT</div>
          <div style={{ width: 96, flex: 'none' }}>INGESTED BY</div>
          <div style={{ width: 80, flex: 'none', textAlign: 'right' }}>CHUNKS</div>
          <div style={{ width: 70, flex: 'none', textAlign: 'right' }}>CLAIMS</div>
          <div style={{ width: 74, flex: 'none', textAlign: 'right' }}>READS</div>
          <div style={{ width: 124, flex: 'none', paddingLeft: 18 }}>TRUST</div>
          <div style={{ width: 70, flex: 'none' }} />
        </div>

        {sources.length === 0 && (
          <div className="empty" style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 14 }}>
              No documents ingested yet. An agent can add one with{' '}
              <span className="mono accent">sources_ingest</span>, or you can run{' '}
              <span className="mono accent">ledger ingest &lt;file&gt; --cluster …</span>.
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            marginTop: 1,
          }}
        >
          {sources.map((source) => {
            const expanded = open === source.id
            return (
              <div key={source.id} className={`source${expanded ? ' source--open' : ''}`}>
                <div className="source__line">
                  <button
                    type="button"
                    className="source__row"
                    onClick={() => setOpen(expanded ? null : source.id)}
                  >
                    <div className="mono dim" style={{ width: 16, flex: 'none', fontSize: 10 }}>
                      {expanded ? '▾' : '▸'}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                      }}
                    >
                      <span className="pill" style={{ background: '#9a76dd' }}>
                        {source.ext.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 13.5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {source.filename}
                      </span>
                    </div>
                    <div
                      style={{
                        width: 96,
                        flex: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          width: 14,
                          height: 14,
                          background: `${agentColor(source.ingestedBy)}22`,
                          color: agentColor(source.ingestedBy),
                        }}
                      >
                        {initial(source.ingestedBy)}
                      </span>
                      <span className="mono muted" style={{ fontSize: 10 }}>
                        {ago(source.ingestedAt)}
                      </span>
                    </div>
                    <div
                      className="mono"
                      style={{
                        width: 80,
                        flex: 'none',
                        textAlign: 'right',
                        fontSize: 11,
                        color: 'var(--lg-text-muted)',
                      }}
                    >
                      {fmtN(source.chunkCount)}
                    </div>
                    <div
                      className="mono accent"
                      style={{
                        width: 70,
                        flex: 'none',
                        textAlign: 'right',
                        fontSize: 11,
                      }}
                    >
                      {fmtN(source.claimCount)}
                    </div>
                    <div
                      className="mono muted"
                      style={{
                        width: 74,
                        flex: 'none',
                        textAlign: 'right',
                        fontSize: 11,
                      }}
                    >
                      {fmtN(source.hits)}
                    </div>
                    <div
                      style={{
                        width: 124,
                        flex: 'none',
                        paddingLeft: 18,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(source.trust * 100)}
                        title="how much this document is worth believing — every chunk inherits it"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void retrust(source, Number(e.target.value) / 100)}
                        style={{
                          flex: 1,
                          height: 14,
                          accentColor: strengthColor(source.trust),
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 9.5,
                          color: 'var(--lg-text-faint)',
                          width: 18,
                          textAlign: 'right',
                        }}
                      >
                        {Math.round(source.trust * 100)}
                      </span>
                    </div>
                  </button>

                  <div className="source__drop">
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => void drop(source)}
                      aria-label={`Drop ${source.filename} and its ${source.chunkCount} chunks`}
                    >
                      DROP
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="source__detail">
                    {source.claimList.length > 0 && (
                      <>
                        <div className="eyebrow" style={{ margin: '8px 0 6px' }}>
                          CLAIMS DISTILLED FROM THIS DOCUMENT
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          {source.claimList.map((claim) => (
                            <button
                              type="button"
                              key={claim.id}
                              className="source__claim"
                              onClick={() => onOpenMemory(claim.id)}
                            >
                              <span style={{ flex: 1 }}>{claim.text}</span>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 9.5,
                                  color: strengthColor(claim.strength),
                                }}
                              >
                                {Math.round(claim.strength * 100)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="eyebrow" style={{ marginBottom: 6 }}>
                      CHUNKS · FIRST {source.chunkPreview.length} OF {fmtN(source.chunkCount)}
                    </div>
                    {source.chunkPreview.map((chunk) => (
                      <div className="source__chunk" key={chunk.id}>
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            color: 'var(--lg-text-ghost)',
                            width: 16,
                            flex: 'none',
                          }}
                        >
                          {chunk.chunkIndex}
                        </span>
                        <span style={{ flex: 1 }}>{oneLine(chunk.text)}</span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            color: 'var(--lg-text-trace)',
                          }}
                        >
                          {fmtN(chunk.hits)} reads
                        </span>
                      </div>
                    ))}

                    <div className="dim" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
                      Dropping this source removes all {fmtN(source.chunkCount)} chunks and flags
                      the {fmtN(source.claimCount)} claims that cite it for re-review.
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
