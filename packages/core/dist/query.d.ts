import { type Result } from 'neverthrow';
import type { LedgerFailure } from './errors.ts';
/** Filter keys accepted in the search box, with the hint the autocomplete shows. */
export declare const FILTER_KEYS: readonly [readonly ["agent", "written or read by an agent"], readonly ["cluster", "topic cluster"], readonly ["type", "chat or doc"], readonly ["kind", "claim or chunk"], readonly ["strength", "how much the store trusts it, e.g. strength:<40"], readonly ["asof", "knowledge as it stood on a date"], readonly ["after", "created after a date"], readonly ["before", "created before a date"]];
export type FilterKey = (typeof FILTER_KEYS)[number][0];
/** `strength:<40` / `strength:>70` — expressed 0..100 in the query, 0..1 internally. */
export type StrengthBound = {
    readonly op: '<' | '>';
    readonly value: number;
};
export type ParsedQuery = {
    /** Free-text terms, lowercased. */
    readonly terms: readonly string[];
    readonly agent: readonly string[];
    readonly cluster: readonly string[];
    readonly type: readonly string[];
    readonly kind: readonly string[];
    readonly strength: StrengthBound | null;
    /**
     * Time travel. `asof` is the interesting one: it asks what the store knew on
     * a date, so it must also resurrect memories dropped since — which is why
     * deletes are soft.
     */
    readonly asOf: number | null;
    readonly before: number | null;
    readonly after: number | null;
};
/**
 * `30d`, `2w`, `6mo`, `1y` relative to now, or anything `Date.parse` accepts.
 * Returns null for unparseable input so the caller can report the bad token.
 */
export declare const parseDate: (input: string, now: number) => number | null;
/**
 * Split a query string into free text and filters.
 *
 * Repeating a key widens rather than narrows — `agent:wren agent:forge` means
 * either agent, which is what someone typing it expects.
 */
export declare const parseQuery: (input: string, now: number) => Result<ParsedQuery, LedgerFailure>;
/** True when the query asks for a moment other than now. */
export declare const isTimeTravel: (q: ParsedQuery) => boolean;
//# sourceMappingURL=query.d.ts.map