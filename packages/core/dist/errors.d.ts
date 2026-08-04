/**
 * Every way a LEDGER operation can fail, as data.
 *
 * Fallible store operations return `Result<T, LedgerFailure>` rather than
 * throwing, so callers cannot ignore a failure by accident and the MCP layer
 * can map each variant to a message an agent can act on. Anything that throws
 * is a bug or a corrupt database — not a modelled outcome.
 */
export type LedgerFailure = {
    readonly kind: 'unknown-cluster';
    readonly cluster: string;
    readonly known: readonly string[];
} | {
    readonly kind: 'unknown-memory';
    readonly id: string;
} | {
    readonly kind: 'unknown-source';
    readonly id: string;
} | {
    readonly kind: 'unknown-conflict';
    readonly id: string;
} | {
    readonly kind: 'unknown-candidate';
    readonly id: string;
} | {
    readonly kind: 'invalid-query';
    readonly token: string;
    readonly reason: string;
} | {
    readonly kind: 'invalid-input';
    readonly issues: readonly string[];
} | {
    readonly kind: 'not-a-claim';
    readonly id: string;
    readonly actual: 'chunk';
} | {
    readonly kind: 'unreadable-source';
    readonly path: string;
    readonly reason: string;
};
/** A one-line, agent-readable rendering of a failure. */
export declare const explain: (f: LedgerFailure) => string;
//# sourceMappingURL=errors.d.ts.map