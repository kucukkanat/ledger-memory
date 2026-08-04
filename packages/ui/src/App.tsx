import type { SearchMode } from '@ledger/core'
import { useCallback, useMemo, useState } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { api } from './api.ts'
import type { FilterControls } from './components/Filters.tsx'
import { SearchBox } from './components/SearchBox.tsx'
import type { FilterFlags, MemoryKind } from './filters.ts'
import { bytes, duration, fmtN } from './format.ts'
import { useDebounced, useLoad, useToast } from './hooks.ts'
import { DEFAULT_SCREEN, pathOf, type Screen, screenOf } from './routes.ts'
import { Browse } from './screens/Browse.tsx'
import { Canvas } from './screens/Canvas.tsx'
import { Connections } from './screens/Connections.tsx'
import { Review } from './screens/Review.tsx'
import { Sources } from './screens/Sources.tsx'

const MODES: readonly SearchMode[] = ['hybrid', 'keyword', 'fuzzy']

const FirstRun = ({ endpoint }: { endpoint: string }) => {
  const config = JSON.stringify(
    { mcpServers: { ledger: { type: 'http', url: `${endpoint}/mcp` } } },
    null,
    2,
  )
  return (
    <div className="screen firstrun">
      <div className="firstrun__inner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span
            className="dot blip"
            style={{
              width: 6,
              height: 6,
              background: 'var(--lg-accent)',
              boxShadow: '0 0 9px var(--lg-accent)',
            }}
          />
          <span className="mono accent" style={{ fontSize: 10, letterSpacing: '0.18em' }}>
            SERVER RUNNING · {endpoint.replace('http://', '')}
          </span>
        </div>
        <div className="firstrun__title">No memories yet.</div>
        <div
          className="muted"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            marginBottom: 26,
            maxWidth: 460,
          }}
        >
          Install the skill in an agent and point it at this machine. Everything it learns is
          written here, and nothing leaves.
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>
          1 · INSTALL THE SKILL
        </div>
        <div className="code">
          <pre>ledger skill install --agent claude</pre>
          <button
            type="button"
            className="code__copy"
            onClick={() =>
              void navigator.clipboard.writeText('ledger skill install --agent claude')
            }
          >
            COPY
          </button>
        </div>

        <div className="eyebrow" style={{ margin: '18px 0 6px' }}>
          2 · POINT IT HERE
        </div>
        <div className="code">
          <pre>{config}</pre>
          <button
            type="button"
            className="code__copy"
            onClick={() => void navigator.clipboard.writeText(config)}
          >
            COPY
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            borderTop: '1px solid var(--lg-border-subtle)',
            paddingTop: 16,
            marginTop: 24,
          }}
        >
          <div className="eq" style={{ height: 11 }}>
            <span style={{ background: 'var(--lg-accent-dim)' }} />
            <span style={{ background: 'var(--lg-accent-dim)' }} />
            <span style={{ background: 'var(--lg-accent-dim)' }} />
          </div>
          <span className="mono dim" style={{ fontSize: 10.5 }}>
            listening for the first write…
          </span>
        </div>
      </div>
    </div>
  )
}

const Loading = () => (
  <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
    <span className="mono dim" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
      LOADING…
    </span>
  </div>
)

const Shell = () => {
  const { toast, show, report } = useToast()

  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The URL is the single source of truth for which view is open — a reload
  // re-derives it instead of dropping the reader back on the default screen.
  const screen = screenOf(pathname)

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('hybrid')
  const [sort, setSort] = useState('strength')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [flags, setFlags] = useState<FilterFlags>({
    pinned: false,
    conflicted: false,
    pending: false,
    archived: false,
  })
  /**
   * Kind is per-screen where everything else in the rail is shared.
   *
   * The table can afford to list chunks — they sort and scroll like anything
   * else. The canvas cannot: chunks outnumber claims several to one and bury
   * the shape of what the fleet actually knows, so it opens on claims and lets
   * you ask for the rest.
   */
  const [browseKind, setBrowseKind] = useState<MemoryKind>('all')
  const [canvasKind, setCanvasKind] = useState<MemoryKind>('claim')
  /** Bumped after any mutation so every dependent panel refetches together. */
  const [revision, setRevision] = useState(0)
  const bump = useCallback(() => setRevision((r) => r + 1), [])

  const debouncedQuery = useDebounced(query)

  const stats = useLoad(() => api.stats(), [revision], report)
  const facets = useLoad(() => api.facets(), [revision], report)
  const review = useLoad(() => api.review(), [revision], report)

  const search = useLoad(
    () =>
      screen === 'browse'
        ? api.search({
            q: debouncedQuery,
            kind: browseKind,
            sort,
            dir,
            limit: 300,
            ...flags,
          })
        : Promise.resolve(null),
    [screen, debouncedQuery, browseKind, sort, dir, flags, revision],
    report,
  )

  const sources = useLoad(
    () => (screen === 'sources' ? api.sources() : Promise.resolve(null)),
    [screen, revision],
    report,
  )

  const agents = useLoad(
    () => (screen === 'connections' ? api.agents() : Promise.resolve(null)),
    [screen, revision],
    report,
  )

  const log = useLoad(
    () => (screen === 'connections' ? api.events(14) : Promise.resolve(null)),
    [screen, revision],
    report,
  )

  const graph = useLoad(
    () =>
      screen === 'canvas'
        ? api.graph({ q: debouncedQuery, kind: canvasKind, ...flags })
        : Promise.resolve(null),
    [screen, debouncedQuery, canvasKind, flags, revision],
    report,
  )

  const endpoint = useMemo(() => window.location.origin, [])

  const onFlag = useCallback(
    (flag: keyof FilterFlags) => setFlags((current) => ({ ...current, [flag]: !current[flag] })),
    [],
  )

  const filters = useMemo(
    (): Omit<FilterControls, 'kind' | 'onKind'> => ({
      query,
      onQuery: setQuery,
      facets: facets.data,
      stats: stats.data,
      flags,
      onFlag,
    }),
    [query, facets.data, stats.data, flags, onFlag],
  )

  const onSort = useCallback(
    (column: string) => {
      if (sort === column) setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      else {
        setSort(column)
        setDir('desc')
      }
    },
    [sort],
  )

  const openMemory = useCallback(
    (id: string) => {
      navigate(pathOf('browse'))
      setQuery(id)
      show('opened in Browse')
    },
    [navigate, show],
  )

  const pendingCount = review.data ? review.data.claims.length + review.data.conflicts.length : 0
  const empty = stats.data !== null && stats.data.memories === 0

  const resultLine = search.data
    ? `${fmtN(search.data.total)} of ${fmtN(stats.data?.memories ?? 0)}`
    : ''

  const nav: readonly [Screen, string, string][] = [
    ['review', 'Review', pendingCount > 0 ? String(pendingCount) : '0'],
    ['browse', 'Browse', fmtN(stats.data?.memories ?? 0)],
    ['sources', 'Sources', fmtN(stats.data?.sources ?? 0)],
    ['canvas', 'Canvas', 'viz'],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__mark" />
          <div className="topbar__name">LEDGER</div>
          <div className="topbar__tag">LOCAL</div>
        </div>

        <div className="topbar__search">
          <SearchBox
            value={query}
            onChange={(next) => {
              setQuery(next)
              if (screen !== 'browse' && screen !== 'canvas') navigate(pathOf('browse'))
            }}
            mode={mode}
            onMode={() =>
              setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length] ?? 'hybrid')
            }
            facets={facets.data}
            stats={stats.data}
            resultLine={screen === 'browse' ? resultLine : ''}
          />
        </div>

        <div className="topbar__status">
          <div className="eq" title="retrieval traffic">
            <span />
            <span />
            <span />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="dot"
              style={{
                width: 5,
                height: 5,
                background: 'var(--lg-accent)',
                boxShadow: '0 0 6px var(--lg-accent)',
              }}
            />
            <span className="mono muted" style={{ fontSize: 10.5 }}>
              {endpoint.replace('http://', '')}
            </span>
          </div>
          <div className="mono dim" style={{ fontSize: 10.5 }}>
            <span style={{ color: 'var(--lg-text)' }}>{fmtN(stats.data?.memories ?? 0)}</span>{' '}
            memories
          </div>
        </div>
      </header>

      <div className="body">
        <nav className="sidebar">
          <div className="sidebar__section eyebrow">MEMORY</div>
          {nav.map(([id, label, count]) => (
            <Link
              key={id}
              to={pathOf(id)}
              className={`sidebar__item${screen === id ? ' sidebar__item--active' : ''}`}
            >
              <span>{label}</span>
              <span
                className={`sidebar__count${
                  id === 'review' && pendingCount > 0 ? ' sidebar__count--alert' : ''
                }`}
              >
                {count}
              </span>
            </Link>
          ))}

          <div className="sidebar__section eyebrow">FLEET</div>
          <Link
            to={pathOf('connections')}
            className={`sidebar__item${screen === 'connections' ? ' sidebar__item--active' : ''}`}
          >
            <span>Connections</span>
            <span className="sidebar__count">{fmtN(stats.data?.agents ?? 0)}</span>
          </Link>

          <div style={{ flex: 1 }} />

          <div className="sidebar__server">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 9,
              }}
            >
              <span
                className="dot blip"
                style={{
                  width: 5,
                  height: 5,
                  background: 'var(--lg-accent)',
                  boxShadow: '0 0 7px var(--lg-accent)',
                }}
              />
              <span className="muted" style={{ fontSize: 9, letterSpacing: '0.16em' }}>
                SERVER RUNNING
              </span>
            </div>
            <div className="sidebar__stat">
              <span>uptime</span>
              <span className="muted">
                {stats.data ? duration(Date.now() - stats.data.startedAt) : '—'}
              </span>
            </div>
            <div className="sidebar__stat">
              <span>requests today</span>
              <span className="muted">{fmtN(stats.data?.requestsToday ?? 0)}</span>
            </div>
            <div className="sidebar__stat">
              <span>on disk</span>
              <span className="muted">{bytes(stats.data?.diskBytes ?? 0)}</span>
            </div>
          </div>
        </nav>

        {empty ? (
          <FirstRun endpoint={endpoint} />
        ) : (
          <Routes>
            <Route
              path={pathOf('review')}
              element={
                review.data ? (
                  <Review
                    data={review.data}
                    reload={bump}
                    notify={show}
                    onError={report}
                    clearedCount={(stats.data?.claims ?? 0) - review.data.claims.length}
                  />
                ) : (
                  <Loading />
                )
              }
            />
            <Route
              path={pathOf('browse')}
              element={
                <Browse
                  controls={{ ...filters, kind: browseKind, onKind: setBrowseKind }}
                  results={search.data}
                  loading={search.loading}
                  reload={bump}
                  notify={show}
                  onError={report}
                  sort={sort}
                  dir={dir}
                  onSort={onSort}
                />
              }
            />
            <Route
              path={pathOf('sources')}
              element={
                sources.data ? (
                  <Sources
                    sources={sources.data}
                    reload={bump}
                    notify={show}
                    onError={report}
                    onOpenMemory={openMemory}
                  />
                ) : (
                  <Loading />
                )
              }
            />
            <Route
              path={pathOf('canvas')}
              element={
                graph.data ? (
                  <Canvas
                    graph={graph.data}
                    controls={{ ...filters, kind: canvasKind, onKind: setCanvasKind }}
                    reload={bump}
                    notify={show}
                    onError={report}
                  />
                ) : (
                  <Loading />
                )
              }
            />
            <Route
              path={pathOf('connections')}
              element={
                agents.data && stats.data ? (
                  <Connections
                    stats={stats.data}
                    agents={agents.data}
                    log={log.data ?? []}
                    endpoint={endpoint}
                    notify={show}
                  />
                ) : (
                  <Loading />
                )
              }
            />
            {/* Bare `#/`, a stale bookmark, or a typo — rewritten, not a blank
                screen. `replace` keeps it out of the back button. */}
            <Route path="*" element={<Navigate to={pathOf(DEFAULT_SCREEN)} replace />} />
          </Routes>
        )}
      </div>

      {toast && (
        <div className={`toast${toast.tone === 'error' ? ' toast--error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

/**
 * The router lives inside `App` rather than at the mount point, so embedding
 * `<App />` is still the whole contract — see `routes.ts` for why it hashes.
 */
export const App = () => (
  <HashRouter>
    <Shell />
  </HashRouter>
)
