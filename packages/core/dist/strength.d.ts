import type { StrengthFactors } from './types.ts';
/** Time constant of the freshness decay: a memory unread for this long keeps ~37% of its freshness. */
export declare const FRESHNESS_TAU_DAYS = 190;
/**
 * Weights of the three signals. The floor is what a brand-new, never-read,
 * single-source claim is worth: not nothing, but not much.
 */
export declare const WEIGHTS: {
    readonly floor: 0.17;
    readonly used: 0.27;
    readonly fresh: 0.34;
    readonly corroborated: 0.22;
};
/** A claim never reaches certainty and never quite reaches zero. */
export declare const BOUNDS: {
    readonly min: 0.04;
    readonly max: 0.99;
};
/** Pinning opts a claim out of decay entirely — it is held here regardless of use. */
export declare const PINNED_STRENGTH: 0.99;
/** Chunk strength is clamped to this band so a source's trust cannot imply certainty. */
export declare const CHUNK_BOUNDS: {
    readonly min: 0.15;
    readonly max: 0.97;
};
export type StrengthInput = {
    readonly hits: number;
    readonly lastReadAt: number;
    readonly sourceCount: number;
    readonly readerCount: number;
    readonly now: number;
};
/** The three signals, each normalised to 0..1. */
export declare const factorsOf: (input: StrengthInput) => StrengthFactors;
/** Weighted strength of a claim, from its three signals. */
export declare const strengthOf: (factors: StrengthFactors) => number;
/**
 * Strength of a chunk: whatever its source is trusted at, clamped.
 *
 * Chunks deliberately do not decay. A document is either trustworthy or it is
 * not, and that judgement belongs to the source, not to how often a particular
 * paragraph happened to be retrieved.
 */
export declare const chunkStrength: (sourceTrust: number) => number;
/** Days of no reads before a claim's strength falls to `target`, ignoring other signals. */
export declare const daysUntil: (input: StrengthInput, target: number) => number;
//# sourceMappingURL=strength.d.ts.map