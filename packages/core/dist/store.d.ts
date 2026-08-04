import { Database } from 'bun:sqlite';
import { type Result } from 'neverthrow';
import type { LedgerFailure } from './errors.ts';
import { type ParsedQuery } from './query.ts';
import type { Agent, Cluster, Conflict, ConflictCandidate, ConflictKind, ConflictResolution, LogEntry, Memory, MemoryOrigin, SearchHit, SearchMode, Source, Stats } from './types.ts';
/**
 * Ceiling on rows pulled into memory for ranking in a single search.
 *
 * Strength cannot be filtered or sorted in SQL — it is a function of the
 * current time — so ranking happens in TypeScript over a bounded window. When
 * the window fills, results say so (`capped`) rather than quietly pretending
 * to be the whole answer.
 */
export declare const SCAN_LIMIT = 5000;
/** Claims compared against a new write when looking for conflict candidates. */
export declare const CANDIDATE_COMPARISONS = 500;
export type StoreOptions = {
    /** Path to the SQLite file, or `:memory:` for tests. */
    readonly path: string;
    /** Injectable clock. Every timestamp in the store comes from here. */
    readonly clock?: () => number;
    /** Seed the starting cluster taxonomy on first open. Default true. */
    readonly seed?: boolean;
};
export type WriteInput = {
    readonly text: string;
    readonly cluster: string;
    readonly agent: string;
    readonly origin?: MemoryOrigin;
    readonly provenance?: string;
    readonly sourceId?: string | null;
    /** Explicitly declare that this replaces an existing claim. */
    readonly supersedes?: string | null;
    readonly createdAt?: number;
};
export type SearchInput = {
    readonly query: string;
    readonly agent?: string;
    readonly mode?: SearchMode;
    readonly limit?: number;
    readonly offset?: number;
    readonly kind?: 'claim' | 'chunk' | 'all';
    readonly includeArchived?: boolean;
    readonly pendingOnly?: boolean;
    readonly conflictedOnly?: boolean;
    readonly pinnedOnly?: boolean;
    readonly sort?: 'relevance' | 'strength' | 'hits' | 'created' | 'last';
    readonly dir?: 'asc' | 'desc';
    /**
     * Whether this read counts as retrieval.
     *
     * An agent retrieving a memory is evidence the memory is useful, and feeds
     * `used`/`fresh`. A human scrolling the Browse table is not — if it were, the
     * act of supervising the store would inflate the numbers being supervised.
     * MCP passes true; the UI passes false.
     */
    readonly countRead?: boolean;
};
export type SearchResult = {
    readonly hits: readonly SearchHit[];
    readonly total: number;
    readonly tookMs: number;
    /** True when more rows matched than the scan window could rank. */
    readonly capped: boolean;
};
export type IngestInput = {
    readonly filename: string;
    readonly cluster: string;
    readonly agent: string;
    /** Pre-extracted text. Required for formats the server cannot read itself. */
    readonly text: string;
    readonly trust?: number;
    readonly bytes?: number;
};
export type SourceSummary = Source & {
    readonly chunkCount: number;
    readonly claimCount: number;
    readonly hits: number;
};
export type JudgeInput = {
    readonly candidateId: string;
    readonly agent: string;
    readonly verdict: 'conflict' | 'unrelated';
    readonly kind?: ConflictKind;
    readonly detector?: number;
    readonly note?: string;
};
export type Store = ReturnType<typeof openStore>;
export declare const openStore: (options: StoreOptions) => {
    db: Database;
    now: () => number;
    close: () => void;
    clusters: {
        list: () => Cluster[];
        create: (input: {
            id?: string;
            label: string;
            color?: string;
        }) => Result<Cluster, LedgerFailure>;
        rename: (id: string, label: string) => Result<Cluster, LedgerFailure>;
    };
    agents: {
        list: () => Agent[];
        describe: (id: string, patch: {
            role?: string;
            endpoint?: string;
            readScope?: string;
            writeScope?: string;
            label?: string;
        }) => Agent;
        /** Per-agent activity for the Connections screen. */
        activity: (id: string) => {
            wrote: number;
            calls: number;
            hitRate: number | null;
            top: {
                id: string;
                label: string;
                color: string;
                n: number;
            }[];
        };
        /** Memories readable by each pair of agents — the "shared knowledge" panel. */
        overlap: () => {
            a: string;
            b: string;
            n: number;
        }[];
    };
    memories: {
        write: (input: WriteInput) => Result<Memory, LedgerFailure>;
        get: (id: string, readBy?: string) => Result<Memory, LedgerFailure>;
        /**
         * Register that an agent retrieved these memories.
         *
         * This is the only thing that moves `used` and `fresh`, which is why it is
         * an explicit call rather than a side effect of any read.
         */
        countReads: (ids: readonly string[], agent: string) => void;
        search: (input: SearchInput) => Result<SearchResult, LedgerFailure>;
        update: (id: string, patch: {
            text?: string;
            cluster?: string;
            provenance?: string;
        }, agent: string) => Result<Memory, LedgerFailure>;
        pin: (ids: readonly string[], pinned: boolean, agent: string) => number;
        archive: (ids: readonly string[], archived: boolean, agent: string) => number;
        remove: (ids: readonly string[], agent: string) => number;
        /**
         * Fold several memories into the first.
         *
         * Hits are summed and readers unioned because the merged memory genuinely
         * carries all that evidence — losing it would understate the strength of
         * the thing that survives.
         */
        merge: (ids: readonly string[], agent: string) => Result<Memory, LedgerFailure>;
        link: (a: string, b: string, agent: string) => Result<void, LedgerFailure>;
        /** Linked memories, falling back to cluster siblings when nothing is linked. */
        related: (id: string, limit?: number) => Memory[];
        exportJsonl: (ids: readonly string[]) => string;
        /** Facet counts for the Browse sidebar, over everything not deleted. */
        facets: () => {
            origin: {
                origin: string;
                n: number;
            }[];
            cluster: {
                cluster_id: string;
                n: number;
            }[];
            agent: {
                agent_id: string;
                n: number;
            }[];
            flags: {
                pinned: number;
                archived: number;
                conflicted: number;
                pending: number;
            };
        };
    };
    review: {
        /**
         * Claims nobody has looked at yet.
         *
         * Pending claims are already searchable — review is an audit, not a gate.
         * A memory store that only works once you have cleared a queue is a memory
         * store that does not work.
         */
        pending: (limit?: number) => Memory[];
        keep: (id: string, agent: string) => Result<Memory, LedgerFailure>;
        pin: (id: string, agent: string) => Result<Memory, LedgerFailure>;
        drop: (id: string, agent: string) => Result<void, LedgerFailure>;
        edit: (id: string, text: string, agent: string) => Result<Memory, LedgerFailure>;
    };
    conflicts: {
        /** Pairs waiting for an agent's judgement, most suspicious first. */
        candidates: (limit?: number) => ConflictCandidate[];
        /** An agent's verdict on a candidate. Either it becomes a conflict, or it is settled. */
        judge: (input: JudgeInput) => Result<Conflict | null, LedgerFailure>;
        get: (id: string) => Conflict | null;
        open: (limit?: number) => Conflict[];
        /**
         * Settle a conflict.
         *
         * `a` / `b` retire the loser, `both` records that the two are related
         * rather than contradictory, `merge` folds the newer text into the older
         * memory so its accumulated evidence survives, `dismiss` says the detector
         * was wrong.
         */
        resolve: (id: string, resolution: ConflictResolution, agent: string) => Result<void, LedgerFailure>;
    };
    sources: {
        list: () => SourceSummary[];
        /** Chunks of a source, in document order. */
        chunks: (id: string, limit?: number) => Memory[];
        /** Claims an agent distilled from a source — these *do* enter the review queue. */
        claims: (id: string) => Memory[];
        ingest: (input: IngestInput) => Result<{
            source: Source;
            chunks: number;
        }, LedgerFailure>;
        trust: (id: string, value: number, agent: string) => Result<void, LedgerFailure>;
        /**
         * Drop a source and everything that came out of it.
         *
         * Chunks go — they have no meaning without the document. Claims distilled
         * from it survive, because an agent already judged them worth keeping and
         * they may be corroborated elsewhere. They do go back into the review
         * queue: the evidence behind them just disappeared, so the judgement that
         * kept them deserves to be made again.
         */
        drop: (id: string, agent: string) => Result<{
            chunks: number;
            flagged: number;
        }, LedgerFailure>;
    };
    events: (limit?: number) => LogEntry[];
    stats: () => Stats;
    timeline: (buckets?: number) => {
        at: number;
        n: number;
    }[];
    parse: (query: string) => Result<ParsedQuery, LedgerFailure>;
};
//# sourceMappingURL=store.d.ts.map