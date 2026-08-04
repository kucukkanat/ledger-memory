/**
 * Candidate detection.
 *
 * The server never decides that two claims contradict. Contradiction is a
 * judgement about meaning, and a lexical rule that tries to make it will be
 * confidently wrong about "trains under five hours" versus "flies anything over
 * three hours". What a lexical rule *is* good at is cheaply narrowing millions
 * of pairs down to a handful worth a second look.
 *
 * So: this module proposes. An agent — which can actually read — judges, via
 * `conflicts.candidates` and `conflicts.judge`. The signals travel with the
 * candidate so the agent knows where to look.
 */

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'he',
  'her',
  'his',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'she',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'were',
  'when',
  'which',
  'with',
  'you',
  'your',
])

const NEGATION =
  /\b(never|not|no longer|isn't|doesn't|don't|cannot|can't|won't|avoid[s]?|avoided|stopped|dropped|without|instead of|rather than|switched)\b/i

const WEEKDAYS = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|days)?\b/gi
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g
const CLOCK = /\b\d{1,2}:\d{2}\b/g
const NUMBER = /\b\d+(?:[.,]\d+)?\b/g

const tokenise = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t))

/** Content words, lowercased, stopwords and pure numbers removed. */
export const contentTokens = (text: string): ReadonlySet<string> => new Set(tokenise(text))

/**
 * The first few content words — in practice, what the claim is *about*.
 *
 * Whole-text overlap alone misses the most common real conflict there is: the
 * same subject with an entirely reworded update. "Trains Tue/Thu/Sun, 8-10km"
 * and "Switched to Mon/Wed/Fri mornings after the knee strain" share exactly
 * one word, yet contradict outright. Comparing subjects separately catches
 * these without dropping the overlap floor far enough to admit noise.
 */
export const headTokens = (text: string, count = 3): ReadonlySet<string> =>
  new Set(tokenise(text).slice(0, count))

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared += 1
  return shared / (a.size + b.size - shared)
}

const matchSet = (text: string, pattern: RegExp): ReadonlySet<string> =>
  new Set((text.match(pattern) ?? []).map((m) => m.toLowerCase()))

const differs = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size === 0 || b.size === 0) return false
  if (a.size !== b.size) return true
  for (const v of a) if (!b.has(v)) return true
  return false
}

/** Minimum topical overlap before a pair is worth an agent's attention. */
export const OVERLAP_FLOOR = 0.18

export type CandidateSignal =
  | 'divergent numbers'
  | 'divergent dates'
  | 'divergent times'
  | 'divergent weekdays'
  | 'divergent months'
  | 'negation on one side'

export type Suspicion = {
  readonly score: number
  readonly signals: readonly CandidateSignal[]
}

/**
 * Decide whether two claim texts are worth proposing as a conflict candidate.
 *
 * Returns null unless they are topically close *and* something concrete
 * diverges. Overlap alone is not suspicious — most claims in a cluster overlap.
 */
export const suspect = (textA: string, textB: string): Suspicion | null => {
  const bodyOverlap = jaccard(contentTokens(textA), contentTokens(textB))
  const headOverlap = jaccard(headTokens(textA), headTokens(textB))
  const overlap = Math.max(bodyOverlap, headOverlap)
  if (overlap < OVERLAP_FLOOR) return null

  const signals: CandidateSignal[] = []
  if (differs(matchSet(textA, NUMBER), matchSet(textB, NUMBER))) signals.push('divergent numbers')
  if (differs(matchSet(textA, ISO_DATE), matchSet(textB, ISO_DATE))) signals.push('divergent dates')
  if (differs(matchSet(textA, CLOCK), matchSet(textB, CLOCK))) signals.push('divergent times')
  if (differs(matchSet(textA, WEEKDAYS), matchSet(textB, WEEKDAYS)))
    signals.push('divergent weekdays')
  if (differs(matchSet(textA, MONTHS), matchSet(textB, MONTHS))) signals.push('divergent months')
  if (NEGATION.test(textA) !== NEGATION.test(textB)) signals.push('negation on one side')

  if (signals.length === 0) return null

  // Overlap says "same subject", signals say "different answer". Both matter,
  // so the score is a blend rather than either alone.
  const divergence = Math.min(1, signals.length / 3)
  return {
    score: Number((overlap * 0.6 + divergence * 0.4).toFixed(4)),
    signals,
  }
}

/** Pair key that is stable regardless of which memory was written first. */
export const pairKey = (a: string, b: string): readonly [string, string] =>
  a < b ? [a, b] : [b, a]
