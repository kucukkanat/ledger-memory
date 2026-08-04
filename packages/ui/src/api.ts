import type {
  Agent,
  Cluster,
  Conflict,
  ConflictCandidate,
  ConflictResolution,
  LogEntry,
  Memory,
  SearchHit,
  Stats,
} from '@ledger/core'

/**
 * Typed client for the supervision API.
 *
 * Failures surface as rejected promises carrying the server's own explanation,
 * which is written for a human — the UI shows it verbatim rather than
 * substituting "something went wrong".
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
      kind?: string
    }
    throw new ApiError(body.error ?? response.statusText, body.kind ?? 'unknown', response.status)
  }
  return (await response.json()) as T
}

export type StatsResponse = Stats & { clusters: Cluster[] }

export type SearchResponse = {
  hits: SearchHit[]
  total: number
  tookMs: number
  capped: boolean
}

export type FacetsResponse = {
  origin: { origin: string; n: number }[]
  cluster: { cluster_id: string; n: number }[]
  agent: { agent_id: string; n: number }[]
  flags: {
    pinned: number
    archived: number
    conflicted: number
    pending: number
  }
}

export type ReviewResponse = {
  claims: Memory[]
  conflicts: Conflict[]
  candidates: ConflictCandidate[]
}

export type SourceRow = {
  id: string
  filename: string
  ext: string
  clusterId: string
  ingestedBy: string
  bytes: number
  trust: number
  ingestedAt: number
  chunkCount: number
  claimCount: number
  hits: number
  chunkPreview: Memory[]
  claimList: Memory[]
}

export type AgentsResponse = {
  agents: (Agent & {
    wrote: number
    calls: number
    /** Null when the agent has not searched at all — no rate to report. */
    hitRate: number | null
    top: { id: string; label: string; color: string; n: number }[]
  })[]
  overlap: { a: string; b: string; n: number }[]
}

export type GraphNode = {
  id: string
  text: string
  cluster: string
  color: string
  writer: string
  strength: number
  hits: number
  createdAt: number
  pinned: boolean
  conflict: boolean
  kind: 'claim' | 'chunk'
}

export type GraphResponse = {
  nodes: GraphNode[]
  links: { a: string; b: string }[]
  clusters: Cluster[]
  capped: boolean
}

export type SearchParams = {
  q?: string
  limit?: number
  offset?: number
  kind?: 'claim' | 'chunk' | 'all'
  sort?: string
  dir?: 'asc' | 'desc'
  archived?: boolean
  pending?: boolean
  pinned?: boolean
  conflicted?: boolean
}

const query = (params: SearchParams): string => {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  // Sent even when it is "all": the canvas defaults to claims when no kind is
  // given, so omitting it would silently mean the opposite of what was asked.
  if (params.kind) search.set('kind', params.kind)
  if (params.sort) search.set('sort', params.sort)
  if (params.dir) search.set('dir', params.dir)
  if (params.archived) search.set('archived', '1')
  if (params.pending) search.set('pending', '1')
  if (params.pinned) search.set('pinned', '1')
  if (params.conflicted) search.set('conflicted', '1')
  return search.toString()
}

export const api = {
  stats: () => request<StatsResponse>('/stats'),
  facets: () => request<FacetsResponse>('/facets'),
  events: (limit = 20) => request<LogEntry[]>(`/events?limit=${limit}`),
  agents: () => request<AgentsResponse>('/agents'),
  timeline: (buckets = 60) => request<{ at: number; n: number }[]>(`/timeline?buckets=${buckets}`),

  search: (params: SearchParams) => request<SearchResponse>(`/search?${query(params)}`),
  memory: (id: string) => request<{ memory: Memory; related: Memory[] }>(`/memories/${id}`),
  updateMemory: (id: string, patch: { text?: string; cluster?: string }) =>
    request<Memory>(`/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  bulk: (op: string, ids: string[]) =>
    request<{ affected: number }>('/memories/bulk', {
      method: 'POST',
      body: JSON.stringify({ op, ids }),
    }),

  /** Export bypasses the JSON client — the response is a file, not a payload. */
  exportJsonl: async (ids: string[]): Promise<void> => {
    const response = await fetch('/api/memories/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'export', ids }),
    })
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = 'ledger-export.jsonl'
    link.click()
    URL.revokeObjectURL(url)
  },

  review: () => request<ReviewResponse>('/review'),
  reviewAction: (id: string, action: 'keep' | 'pin' | 'drop') =>
    request<unknown>(`/review/${id}/${action}`, { method: 'POST' }),
  reviewEdit: (id: string, text: string) =>
    request<Memory>(`/review/${id}/edit`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  resolveConflict: (id: string, resolution: ConflictResolution) =>
    request<unknown>(`/conflicts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),

  sources: () => request<SourceRow[]>('/sources'),
  trustSource: (id: string, trust: number) =>
    request<unknown>(`/sources/${id}/trust`, {
      method: 'POST',
      body: JSON.stringify({ trust }),
    }),
  dropSource: (id: string) =>
    request<{ chunks: number; flagged: number }>(`/sources/${id}`, {
      method: 'DELETE',
    }),

  /** The canvas draws whatever the filter rail is asking for, same as the table. */
  graph: (params: SearchParams) => request<GraphResponse>(`/graph?${query(params)}`),

  createCluster: (label: string) =>
    request<Cluster>('/clusters', {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
}
