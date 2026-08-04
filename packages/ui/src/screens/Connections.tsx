import type { LogEntry } from '@ledger/core'
import { useState } from 'react'
import type { AgentsResponse, StatsResponse } from '../api.ts'
import { agentColor, ago, bytes, clock, duration, fmtN, pct } from '../format.ts'

/**
 * Connections — which agents are attached, what they use memory for, and what
 * they have in common.
 *
 * Scopes here are descriptive. Identity is self-declared on a loopback socket,
 * so this screen reports what agents say they do rather than pretending to
 * enforce it — claiming otherwise would be the worst kind of security theatre
 * in a tool whose whole promise is that you can see what is happening.
 */

export type ConnectionsProps = {
  stats: StatsResponse
  agents: AgentsResponse
  log: LogEntry[]
  endpoint: string
  notify: (message: string) => void
}

const Copyable = ({ text, onCopy }: { text: string; onCopy: () => void }) => (
  <div className="code">
    <pre>{text}</pre>
    <button
      type="button"
      className="code__copy"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        onCopy()
      }}
    >
      COPY
    </button>
  </div>
)

export const Connections = ({ stats, agents, log, endpoint, notify }: ConnectionsProps) => {
  const [copied, setCopied] = useState(false)
  const mcpConfig = JSON.stringify(
    { mcpServers: { ledger: { type: 'http', url: `${endpoint}/mcp` } } },
    null,
    2,
  )

  const onCopy = (): void => {
    setCopied(true)
    notify('copied')
  }

  return (
    <div className="screen screen--scroll">
      <div className="grid-2">
        <div className="panel" style={{ padding: '16px 17px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span
              className="dot blip"
              style={{
                width: 6,
                height: 6,
                background: 'var(--lg-accent)',
                boxShadow: '0 0 8px var(--lg-accent)',
              }}
            />
            <span className="mono accent" style={{ fontSize: 10, letterSpacing: '0.16em' }}>
              SERVER RUNNING
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              {endpoint}
            </span>
          </div>

          <div className="grid-4">
            {(
              [
                ['UPTIME', duration(Date.now() - stats.startedAt)],
                ['REQUESTS TODAY', fmtN(stats.requestsToday)],
                ['P50 SEARCH', `${stats.p50SearchMs.toFixed(1)}ms`],
                ['ON DISK', bytes(stats.diskBytes)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="stat__label">{label}</div>
                <div className="stat__value">{value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--lg-border-subtle)',
              fontSize: 12.5,
              color: '#7d848b',
            }}
          >
            Bound to loopback. No memory in this store has ever left this machine.
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 17px',
            borderColor: 'var(--lg-accent-border)',
          }}
        >
          <div className="eyebrow accent" style={{ marginBottom: 4 }}>
            CONNECT AN AGENT
          </div>
          <div className="dim" style={{ fontSize: 12.5, marginBottom: 13 }}>
            Install the skill, then point the agent at the endpoint.
          </div>
          <Copyable text="ledger skill install --agent claude" onCopy={onCopy} />
          <Copyable text={mcpConfig} onCopy={onCopy} />
          {copied && (
            <div className="dim" style={{ fontSize: 11 }}>
              Restart the agent to pick it up.
            </div>
          )}
        </div>
      </div>

      <div className="grid-3">
        {agents.agents.map((agent) => {
          const tint = agent.color || agentColor(agent.id)
          return (
            <div className="agent__card" key={agent.id}>
              <div className="agent__stripe" style={{ background: tint }} />
              <div className="agent__body">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <span className="mono" style={{ fontSize: 17, fontWeight: 500 }}>
                    {agent.id}
                  </span>
                  <span className="dim" style={{ fontSize: 11.5 }}>
                    {agent.role || 'undeclared'}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="dot" style={{ width: 5, height: 5, background: tint }} />
                  <span className="mono muted" style={{ fontSize: 9.5 }}>
                    {Date.now() - agent.lastSeen < 300_000 ? 'connected' : 'idle'}
                  </span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--lg-text-trace)',
                    marginBottom: 14,
                  }}
                >
                  {agent.endpoint || 'endpoint not declared'}
                </div>

                <div className="grid-3" style={{ marginBottom: 14, gap: 10 }}>
                  {(
                    [
                      ['WROTE', fmtN(agent.wrote)],
                      ['CALLS/24H', fmtN(agent.calls)],
                      ['HIT RATE', agent.hitRate === null ? '—' : pct(agent.hitRate)],
                    ] as const
                  ).map(([label, value], i) => (
                    <div key={label}>
                      <div className="stat__label">{label}</div>
                      <div
                        className="stat__value"
                        style={{
                          fontSize: 19,
                          color: i === 2 ? 'var(--lg-accent)' : undefined,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  TOP CLUSTERS
                </div>
                <div style={{ marginBottom: 14 }}>
                  {agent.top.length === 0 && (
                    <div className="dim" style={{ fontSize: 11 }}>
                      nothing read yet
                    </div>
                  )}
                  {agent.top.map((cluster) => {
                    const widest = agent.top[0]?.n ?? 1
                    return (
                      <div className="agent__bar" key={cluster.id}>
                        <span
                          style={{
                            width: 96,
                            fontSize: 11,
                            color: 'var(--lg-text-dim)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cluster.label}
                        </span>
                        <div className="meter" style={{ height: 4 }}>
                          <div
                            className="meter__fill"
                            style={{
                              width: `${(cluster.n / widest) * 100}%`,
                              background: cluster.color,
                            }}
                          />
                        </div>
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            color: 'var(--lg-text-ghost)',
                            width: 26,
                            textAlign: 'right',
                          }}
                        >
                          {fmtN(cluster.n)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--lg-border-subtle)',
                    paddingTop: 10,
                  }}
                >
                  {(
                    [
                      ['may read', agent.readScope],
                      ['may write', agent.writeScope],
                      ['last call', `${ago(agent.lastSeen)} ago`],
                    ] as const
                  ).map(([label, value]) => (
                    <div className="inspector__row" key={label}>
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 12 }}>
        <div className="panel" style={{ padding: '14px 15px' }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>
            SHARED KNOWLEDGE
          </div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 14 }}>
            Memories both agents have read
          </div>
          {agents.overlap.length === 0 && (
            <div className="dim" style={{ fontSize: 12 }}>
              Nothing shared yet — each memory has only ever been read by the agent that wrote it.
            </div>
          )}
          {agents.overlap.slice(0, 6).map((pair) => {
            const widest = agents.overlap[0]?.n ?? 1
            return (
              <div className="agent__bar" key={`${pair.a}-${pair.b}`} style={{ marginBottom: 5 }}>
                <span className="mono muted" style={{ fontSize: 11, width: 104 }}>
                  {pair.a} · {pair.b}
                </span>
                <div className="meter" style={{ height: 16 }}>
                  <div
                    className="meter__fill"
                    style={{
                      width: `${(pair.n / widest) * 100}%`,
                      background: agentColor(pair.a),
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span className="mono" style={{ fontSize: 11, width: 38, textAlign: 'right' }}>
                  {fmtN(pair.n)}
                </span>
              </div>
            )
          })}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--lg-border-subtle)',
              fontSize: 12,
              color: '#7d848b',
              lineHeight: 1.5,
            }}
          >
            Overlap is what makes corroboration work: a memory two agents have both relied on is
            worth more than one only its author has ever read.
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 15px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span className="eyebrow">REQUEST FEED</span>
            <div className="eq" style={{ height: 9 }}>
              <span style={{ background: 'var(--lg-accent-dim)' }} />
              <span style={{ background: 'var(--lg-accent-dim)' }} />
            </div>
          </div>
          {log.length === 0 && (
            <div className="dim" style={{ fontSize: 12 }}>
              No calls yet.
            </div>
          )}
          {log.map((entry) => (
            <div className="log__row" key={entry.id}>
              <span style={{ color: 'var(--lg-text-trace)', width: 46 }}>{clock(entry.at)}</span>
              <span style={{ color: agentColor(entry.agent), width: 52 }}>{entry.agent}</span>
              <span className="dim" style={{ fontSize: 9.5, width: 110 }}>
                {entry.op}
              </span>
              <span className="log__text">{entry.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
