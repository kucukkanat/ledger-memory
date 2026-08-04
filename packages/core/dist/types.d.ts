/**
 * The LEDGER domain model.
 *
 * The load-bearing distinction is `kind`:
 *
 * - A **claim** is an assertion — something an agent believes to be true. It is
 *   reviewed one at a time, it decays when nothing reads it, and it can
 *   contradict another claim.
 * - A **chunk** is a slice of an ingested document. It is trusted or dropped
 *   *whole with its source*, inherits that source's trust verbatim, never
 *   decays and never enters the review queue. Reviewing ten thousand chunks
 *   individually is not a thing a person can do.
 */
export type MemoryKind = 'claim' | 'chunk';
/** Where a memory came from: something said, or something read. */
export type MemoryOrigin = 'chat' | 'doc';
export type ConflictKind = 'direct contradiction' | 'value drift' | 'stale schedule' | 'stale terms' | 'date conflict' | 'stale fact';
export type ConflictStatus = 'open' | 'resolved' | 'dismissed';
export type ConflictResolution = 'a' | 'b' | 'both' | 'merge' | 'dismiss';
export type Cluster = {
    readonly id: string;
    readonly label: string;
    readonly color: string;
    readonly createdAt: number;
};
export type Agent = {
    readonly id: string;
    readonly label: string;
    readonly role: string;
    readonly color: string;
    readonly endpoint: string;
    /** Advisory only — self-declared identity means scopes describe, not enforce. */
    readonly readScope: string;
    readonly writeScope: string;
    readonly firstSeen: number;
    readonly lastSeen: number;
};
export type Source = {
    readonly id: string;
    readonly filename: string;
    readonly ext: string;
    readonly clusterId: string;
    readonly ingestedBy: string;
    readonly bytes: number;
    /** 0..1. Chunks inherit this verbatim. */
    readonly trust: number;
    readonly ingestedAt: number;
    readonly droppedAt: number | null;
};
/**
 * The three signals behind a claim's strength, exposed so the inspector can
 * show *why* a memory is trusted rather than just how much.
 */
export type StrengthFactors = {
    /** How much it gets retrieved, log-scaled against a 300-read ceiling. */
    readonly used: number;
    /** Exponential decay on time since last read. */
    readonly fresh: number;
    /** Independent sources plus distinct agents that have read it. */
    readonly corroborated: number;
};
export type Memory = {
    readonly id: string;
    readonly text: string;
    readonly kind: MemoryKind;
    readonly origin: MemoryOrigin;
    readonly clusterId: string;
    readonly clusterLabel: string;
    readonly clusterColor: string;
    /** The agent that wrote it. */
    readonly writer: string;
    /** Every agent that has written or read it — drives corroboration. */
    readonly readers: readonly string[];
    readonly sourceId: string | null;
    readonly chunkIndex: number | null;
    readonly provenance: string;
    readonly createdAt: number;
    readonly lastReadAt: number;
    readonly hits: number;
    /** Independent sources asserting the same thing. */
    readonly sourceCount: number;
    readonly pinned: boolean;
    readonly archived: boolean;
    /** Null while the claim is still pending in the review queue. */
    readonly reviewedAt: number | null;
    /** Soft delete, so `asof:` can still answer "what did we know then". */
    readonly deletedAt: number | null;
    /** Computed on read, never stored. */
    readonly strength: number;
    readonly factors: StrengthFactors;
    /** The id of the memory this one is in open conflict with, if any. */
    readonly conflictWith: string | null;
};
export type Conflict = {
    readonly id: string;
    readonly kind: ConflictKind;
    readonly clusterId: string;
    readonly a: Memory;
    readonly b: Memory;
    /** 0..1 — how sure the judging agent was that these really contradict. */
    readonly detector: number;
    readonly note: string;
    readonly status: ConflictStatus;
    readonly createdAt: number;
    readonly resolvedAt: number | null;
};
/**
 * A pair the server thinks *might* contradict. The server never decides on its
 * own: it proposes cheaply (same cluster, overlapping terms, divergent
 * numbers/dates/negation) and an agent returns the verdict.
 */
export type ConflictCandidate = {
    readonly id: string;
    readonly a: Memory;
    readonly b: Memory;
    /** 0..1 lexical suspicion — ranking only, not a verdict. */
    readonly score: number;
    /** Why the pair was proposed, so the judging agent knows where to look. */
    readonly signals: readonly string[];
    readonly createdAt: number;
};
export type LogEntry = {
    readonly id: number;
    readonly at: number;
    readonly agent: string;
    readonly op: string;
    readonly memoryId: string | null;
    readonly detail: string;
};
export type SearchMode = 'hybrid' | 'keyword' | 'fuzzy';
export type SearchHit = Memory & {
    readonly score: number;
};
export type Stats = {
    readonly memories: number;
    readonly claims: number;
    readonly chunks: number;
    readonly pending: number;
    readonly conflicts: number;
    readonly candidates: number;
    readonly sources: number;
    readonly agents: number;
    readonly requestsToday: number;
    readonly diskBytes: number;
    readonly startedAt: number;
    readonly p50SearchMs: number;
    readonly lastWriteAt: number | null;
};
//# sourceMappingURL=types.d.ts.map