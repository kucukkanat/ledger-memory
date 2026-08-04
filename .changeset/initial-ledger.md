---
'@ledger/tokens': minor
'@ledger/core': minor
'@ledger/server': minor
'@ledger/cli': minor
---

Initial release of LEDGER — local memory for a fleet of agents, with a human in
the loop, shipped as an installable skill.

- **`@ledger/core`** — SQLite + FTS5 store. Claims decay, chunks inherit their
  source's trust and never do. Strength is recomputed on every read from
  used/fresh/corroborated rather than stored. Deletes are soft so `asof:` can
  answer what the fleet believed on a date, including memories dropped since and
  including full-text queries. Conflict *candidates* are proposed lexically;
  verdicts come from agents.
- **`@ledger/cli`** — the whole agent and human surface, bundled to a single
  `cli.js` that ships inside the skill. `recall` counts as a retrieval and
  `search` does not; they are separate verbs rather than one command with a flag
  precisely so the distinction cannot be lost by accident. No `resolve` in the
  agent section — choosing which memory survives is the human's decision.
- **`@ledger/server`** — loopback-bound supervision API and UI host. Not on the
  agent path at all: agents open the SQLite file through the CLI, so memory keeps
  working whether or not this is running.
- **`@ledger/tokens`** — one palette, consumed as CSS custom properties by the UI
  and as TypeScript by the canvas and the CLI's ANSI output.

Distribution is `npx skills add`, which copies files and never runs a build — so
`skills/ledger-memory/{cli.js,ui}` are committed build artifacts, regenerated
with `bun run build:skill`.
