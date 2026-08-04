import type { Memory } from './types.ts';
/** The shape every memory query returns, before hydration. */
export type MemoryRow = {
    id: string;
    text: string;
    kind: string;
    origin: string;
    cluster_id: string;
    cluster_label: string;
    cluster_color: string;
    writer: string;
    source_id: string | null;
    source_trust: number | null;
    chunk_index: number | null;
    provenance: string;
    created_at: number;
    last_read_at: number;
    hits: number;
    source_count: number;
    pinned: number;
    archived: number;
    reviewed_at: number | null;
    deleted_at: number | null;
    readers: string | null;
    conflict_with: string | null;
};
/**
 * The one place a stored row becomes a domain object — and the one place
 * strength is calculated. Keeping it here is what stops a stale strength from
 * ever being written down.
 */
export declare const SELECT_MEMORY = "\nSELECT\n  m.*,\n  c.label AS cluster_label,\n  c.color AS cluster_color,\n  s.trust AS source_trust,\n  (SELECT group_concat(agent_id, ',') FROM memory_readers r WHERE r.memory_id = m.id) AS readers,\n  (SELECT CASE WHEN cf.a = m.id THEN cf.b ELSE cf.a END\n     FROM conflicts cf\n    WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id)\n    LIMIT 1) AS conflict_with\nFROM memories m\nJOIN clusters c ON c.id = m.cluster_id\nLEFT JOIN sources s ON s.id = m.source_id\n";
export declare const hydrate: (row: MemoryRow, now: number) => Memory;
//# sourceMappingURL=rows.d.ts.map