import { homedir } from 'node:os'
import { join } from 'node:path'

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
export const storePath = (): string =>
  process.env['LEDGER_DB'] ?? join(homedir(), '.ledger', 'ledger.db')

/** Who is acting, when nothing says otherwise. */
export const defaultAgent = (): string => process.env['LEDGER_AGENT'] ?? 'agent'

/**
 * Built UI assets.
 *
 * Next to the bundled CLI once installed; up in the workspace when running from
 * source. Checked in that order so `bun run dev` and an installed skill both work.
 */
export const uiCandidates = (): string[] => [
  join(import.meta.dir, 'ui'),
  join(import.meta.dir, '..', '..', 'ui', 'dist'),
]

export const findUi = async (): Promise<string | null> => {
  for (const candidate of uiCandidates()) {
    if (await Bun.file(join(candidate, 'index.html')).exists()) return candidate
  }
  return null
}
