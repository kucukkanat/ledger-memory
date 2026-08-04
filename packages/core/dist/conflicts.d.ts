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
/** Content words, lowercased, stopwords and pure numbers removed. */
export declare const contentTokens: (text: string) => ReadonlySet<string>;
/**
 * The first few content words — in practice, what the claim is *about*.
 *
 * Whole-text overlap alone misses the most common real conflict there is: the
 * same subject with an entirely reworded update. "Trains Tue/Thu/Sun, 8-10km"
 * and "Switched to Mon/Wed/Fri mornings after the knee strain" share exactly
 * one word, yet contradict outright. Comparing subjects separately catches
 * these without dropping the overlap floor far enough to admit noise.
 */
export declare const headTokens: (text: string, count?: number) => ReadonlySet<string>;
/** Minimum topical overlap before a pair is worth an agent's attention. */
export declare const OVERLAP_FLOOR = 0.18;
export type CandidateSignal = 'divergent numbers' | 'divergent dates' | 'divergent times' | 'divergent weekdays' | 'divergent months' | 'negation on one side';
export type Suspicion = {
    readonly score: number;
    readonly signals: readonly CandidateSignal[];
};
/**
 * Decide whether two claim texts are worth proposing as a conflict candidate.
 *
 * Returns null unless they are topically close *and* something concrete
 * diverges. Overlap alone is not suspicious — most claims in a cluster overlap.
 */
export declare const suspect: (textA: string, textB: string) => Suspicion | null;
/** Pair key that is stable regardless of which memory was written first. */
export declare const pairKey: (a: string, b: string) => readonly [string, string];
//# sourceMappingURL=conflicts.d.ts.map