/**
 * Where things live once the skill is installed.
 *
 * `skills add` copies this directory to `.claude/skills/ledger-memory/` (or the
 * global equivalent), so the bundled CLI has to find its own assets relative to
 * itself rather than relative to a repo it is no longer part of.
 */
/**
 * The store, shared by every agent on the machine.
 *
 * Deliberately *not* inside the skill directory: the skill can be installed per
 * project, but memory is a property of the machine and its owner. Two projects
 * should not end up with two disjoint memories of the same person.
 */
export declare const storePath: () => string;
/** Who is acting, when nothing says otherwise. */
export declare const defaultAgent: () => string;
/**
 * Built UI assets.
 *
 * Next to the bundled CLI once installed; up in the workspace when running from
 * source. Checked in that order so `bun run dev` and an installed skill both work.
 */
export declare const uiCandidates: () => string[];
export declare const findUi: () => Promise<string | null>;
//# sourceMappingURL=paths.d.ts.map