/**
 * Ranking primitives.
 *
 * There are no embeddings here and that is deliberate: a local memory store
 * that ships a model becomes a hundreds-of-megabytes download and an
 * index-on-every-write cost, to beat BM25 on paraphrases that a fleet of agents
 * writing in their own words mostly does not produce. `hybrid` here means
 * lexical recall (BM25) widened with character-level fuzz, not vectors.
 */
/**
 * Build an FTS5 MATCH expression.
 *
 * Terms are OR-ed rather than AND-ed so a query that is partly wrong still
 * returns something; BM25 then sorts the rows that matched more of it to the
 * top. `keyword` mode requires whole words, other modes allow prefix matches.
 */
export declare const ftsQuery: (terms: readonly string[], prefix: boolean) => string | null;
/** BM25 returns lower-is-better and unbounded; searchers want higher-is-better and bounded. */
export declare const normaliseBm25: (bm25: number) => number;
/**
 * Character-trigram similarity of a query against a text.
 *
 * Containment rather than Jaccard: a short query inside a long memory should
 * score high, and Jaccard would punish it for the length difference.
 */
export declare const fuzzyScore: (query: string, text: string) => number;
/** Below this, a fuzzy match is noise. */
export declare const FUZZY_FLOOR = 0.42;
/**
 * Blend of relevance and strength.
 *
 * Relevance dominates — a strong memory about the wrong thing is still the
 * wrong thing — but strength breaks ties, so a decaying claim ranks below an
 * equally relevant one the fleet actually relies on.
 */
export declare const rank: (relevance: number, strength: number) => number;
//# sourceMappingURL=search.d.ts.map