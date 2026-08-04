import { chunkStrength, factorsOf, PINNED_STRENGTH, strengthOf } from './strength.ts'
import type { Memory } from './types.ts'

/** The shape every memory query returns, before hydration. */
export type MemoryRow = {
  id: string
  text: string
  kind: string
  origin: string
  cluster_id: string
  cluster_label: string
  cluster_color: string
  writer: string
  source_id: string | null
  source_trust: number | null
  chunk_index: number | null
  provenance: string
  created_at: number
  last_read_at: number
  hits: number
  source_count: number
  pinned: number
  archived: number
  reviewed_at: number | null
  deleted_at: number | null
  readers: string | null
  conflict_with: string | null
}

/**
 * The one place a stored row becomes a domain object — and the one place
 * strength is calculated. Keeping it here is what stops a stale strength from
 * ever being written down.
 */
export const SELECT_MEMORY = `
SELECT
  m.*,
  c.label AS cluster_label,
  c.color AS cluster_color,
  s.trust AS source_trust,
  (SELECT group_concat(agent_id, ',') FROM memory_readers r WHERE r.memory_id = m.id) AS readers,
  (SELECT CASE WHEN cf.a = m.id THEN cf.b ELSE cf.a END
     FROM conflicts cf
    WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id)
    LIMIT 1) AS conflict_with
FROM memories m
JOIN clusters c ON c.id = m.cluster_id
LEFT JOIN sources s ON s.id = m.source_id
`

const split = (value: string | null): string[] => (value ? value.split(',').filter(Boolean) : [])

export const hydrate = (row: MemoryRow, now: number): Memory => {
  const readers = split(row.readers)
  const factors = factorsOf({
    hits: row.hits,
    lastReadAt: row.last_read_at,
    sourceCount: row.source_count,
    readerCount: readers.length,
    now,
  })

  const strength =
    row.kind === 'chunk'
      ? chunkStrength(row.source_trust ?? 0.7)
      : row.pinned === 1
        ? PINNED_STRENGTH
        : strengthOf(factors)

  return {
    id: row.id,
    text: row.text,
    kind: row.kind === 'chunk' ? 'chunk' : 'claim',
    origin: row.origin === 'doc' ? 'doc' : 'chat',
    clusterId: row.cluster_id,
    clusterLabel: row.cluster_label,
    clusterColor: row.cluster_color,
    writer: row.writer,
    readers,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    provenance: row.provenance,
    createdAt: row.created_at,
    lastReadAt: row.last_read_at,
    hits: row.hits,
    sourceCount: row.source_count,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    reviewedAt: row.reviewed_at,
    deletedAt: row.deleted_at,
    strength,
    factors,
    conflictWith: row.conflict_with,
  }
}
