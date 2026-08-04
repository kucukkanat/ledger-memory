import { type StoreOptions } from '@ledger/core';
import { Hono } from 'hono';
export { createApi } from './api.ts';
export type ServerOptions = {
    readonly store: StoreOptions;
    readonly port?: number;
    /**
     * Interface to bind.
     *
     * Loopback by default and on purpose: this is the whole privacy claim. A
     * store that never leaves the machine is a store nothing off the machine can
     * reach. Changing this is a deliberate act, not a default.
     */
    readonly host?: string;
    /** Directory of built UI assets. Omit to run headless. */
    readonly ui?: string;
};
export declare const DEFAULT_PORT = 7444;
/**
 * The supervision server: the API the UI talks to, and the UI itself.
 *
 * There is no agent-facing surface here. Agents reach the store through the
 * bundled CLI, which opens the SQLite file directly — so this process is
 * something you start when you want to *look* at your memory, and can leave
 * stopped the rest of the time without agents losing the ability to remember.
 *
 * Nothing here counts as retrieval. A human reading the store is not evidence
 * that a memory is useful.
 */
export declare const createServer: (options: ServerOptions) => {
    store: {
        db: import("bun:sqlite").Database;
        now: () => number;
        close: () => void;
        clusters: {
            list: () => import("@ledger/core").Cluster[];
            create: (input: {
                id?: string;
                label: string;
                color?: string;
            }) => import("neverthrow").Result<import("@ledger/core").Cluster, import("@ledger/core").LedgerFailure>;
            rename: (id: string, label: string) => import("neverthrow").Result<import("@ledger/core").Cluster, import("@ledger/core").LedgerFailure>;
        };
        agents: {
            list: () => import("@ledger/core").Agent[];
            describe: (id: string, patch: {
                role?: string;
                endpoint?: string;
                readScope?: string;
                writeScope?: string;
                label?: string;
            }) => import("@ledger/core").Agent;
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
            overlap: () => {
                a: string;
                b: string;
                n: number;
            }[];
        };
        memories: {
            write: (input: import("@ledger/core").WriteInput) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            get: (id: string, readBy?: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            countReads: (ids: readonly string[], agent: string) => void;
            search: (input: import("@ledger/core").SearchInput) => import("neverthrow").Result<import("@ledger/core").SearchResult, import("@ledger/core").LedgerFailure>;
            update: (id: string, patch: {
                text?: string;
                cluster?: string;
                provenance?: string;
            }, agent: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            pin: (ids: readonly string[], pinned: boolean, agent: string) => number;
            archive: (ids: readonly string[], archived: boolean, agent: string) => number;
            remove: (ids: readonly string[], agent: string) => number;
            merge: (ids: readonly string[], agent: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            link: (a: string, b: string, agent: string) => import("neverthrow").Result<void, import("@ledger/core").LedgerFailure>;
            related: (id: string, limit?: number) => import("@ledger/core").Memory[];
            exportJsonl: (ids: readonly string[]) => string;
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
            pending: (limit?: number) => import("@ledger/core").Memory[];
            keep: (id: string, agent: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            pin: (id: string, agent: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
            drop: (id: string, agent: string) => import("neverthrow").Result<void, import("@ledger/core").LedgerFailure>;
            edit: (id: string, text: string, agent: string) => import("neverthrow").Result<import("@ledger/core").Memory, import("@ledger/core").LedgerFailure>;
        };
        conflicts: {
            candidates: (limit?: number) => import("@ledger/core").ConflictCandidate[];
            judge: (input: import("@ledger/core").JudgeInput) => import("neverthrow").Result<import("@ledger/core").Conflict | null, import("@ledger/core").LedgerFailure>;
            get: (id: string) => import("@ledger/core").Conflict | null;
            open: (limit?: number) => import("@ledger/core").Conflict[];
            resolve: (id: string, resolution: import("@ledger/core").ConflictResolution, agent: string) => import("neverthrow").Result<void, import("@ledger/core").LedgerFailure>;
        };
        sources: {
            list: () => import("@ledger/core").SourceSummary[];
            chunks: (id: string, limit?: number) => import("@ledger/core").Memory[];
            claims: (id: string) => import("@ledger/core").Memory[];
            ingest: (input: import("@ledger/core").IngestInput) => import("neverthrow").Result<{
                source: import("@ledger/core").Source;
                chunks: number;
            }, import("@ledger/core").LedgerFailure>;
            trust: (id: string, value: number, agent: string) => import("neverthrow").Result<void, import("@ledger/core").LedgerFailure>;
            drop: (id: string, agent: string) => import("neverthrow").Result<{
                chunks: number;
                flagged: number;
            }, import("@ledger/core").LedgerFailure>;
        };
        events: (limit?: number) => import("@ledger/core").LogEntry[];
        stats: () => import("@ledger/core").Stats;
        timeline: (buckets?: number) => {
            at: number;
            n: number;
        }[];
        parse: (query: string) => import("neverthrow").Result<import("@ledger/core").ParsedQuery, import("@ledger/core").LedgerFailure>;
    };
    app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
    listen: () => {
        url: string;
        stop: () => Promise<void>;
    };
};
//# sourceMappingURL=index.d.ts.map