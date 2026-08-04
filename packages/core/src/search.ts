/**
 * Ranking primitives.
 *
 * There are no embeddings here and that is deliberate: a local memory store
 * that ships a model becomes a hundreds-of-megabytes download and an
 * index-on-every-write cost, to beat BM25 on paraphrases that a fleet of agents
 * writing in their own words mostly does not produce. `hybrid` here means
 * lexical recall (BM25) widened with character-level fuzz, not vectors.
 */

/** Escape a term for an FTS5 MATCH expression. */
const ftsTerm = (term: string): string => `"${term.replace(/"/g, '""')}"`

/**
 * Build an FTS5 MATCH expression.
 *
 * Terms are OR-ed rather than AND-ed so a query that is partly wrong still
 * returns something; BM25 then sorts the rows that matched more of it to the
 * top. `keyword` mode requires whole words, other modes allow prefix matches.
 */
export const ftsQuery = (terms: readonly string[], prefix: boolean): string | null => {
  const usable = terms.filter((t) => /[\p{L}\p{N}]/u.test(t))
  if (usable.length === 0) return null
  return usable.map((t) => (prefix ? `${ftsTerm(t)}*` : ftsTerm(t))).join(' OR ')
}

/** BM25 returns lower-is-better and unbounded; searchers want higher-is-better and bounded. */
export const normaliseBm25 = (bm25: number): number => {
  const positive = Math.max(0, -bm25)
  return positive / (positive + 1)
}

const trigrams = (text: string): ReadonlySet<string> => {
  const padded = ` ${text.toLowerCase().replace(/\s+/g, ' ').trim()} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3))
  return out
}

/**
 * Character-trigram similarity of a query against a text.
 *
 * Containment rather than Jaccard: a short query inside a long memory should
 * score high, and Jaccard would punish it for the length difference.
 */
export const fuzzyScore = (query: string, text: string): number => {
  const q = trigrams(query)
  if (q.size === 0) return 0
  const t = trigrams(text)
  let shared = 0
  for (const g of q) if (t.has(g)) shared += 1
  return shared / q.size
}

/** Below this, a fuzzy match is noise. */
export const FUZZY_FLOOR = 0.42

/**
 * Blend of relevance and strength.
 *
 * Relevance dominates — a strong memory about the wrong thing is still the
 * wrong thing — but strength breaks ties, so a decaying claim ranks below an
 * equally relevant one the fleet actually relies on.
 */
export const rank = (relevance: number, strength: number): number =>
  relevance * 0.75 + strength * 0.25
