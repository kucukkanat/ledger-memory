# @ledger/cli

Everything an agent and a human can do with a LEDGER store. This package bundles
to the single `cli.js` that ships inside the skill.

```bash
bun run build:skill    # from the workspace root
```

## Two audiences, one binary

The split is load-bearing:

| | Commands | Counts as retrieval? |
| --- | --- | --- |
| **Agent** | `recall` `remember` `forget` `link` `clusters` `conflicts` `judge` `ingest` | `recall` does |
| **Human** | `search` `review` `serve` `resolve` `sources` `stats` `export` | never |

`recall` and `search` do the same query and return the same rows. They are
separate verbs because one of them feeds the strength scores and the other must
not, and a single command with a `--count-read` flag would eventually be called
wrongly — silently, and unrecoverably.

## For agents

```bash
ledger clusters                      # learn the taxonomy before the first write

ledger remember "opal requires Node 22 — 20 breaks the wasm loader" \
  --cluster code --tags opal,build --note "confirmed by follow-up question"
# remembered m_msefw27xjzi7rd

ledger recall "node wasm loader"
# 1 memory
# m_msefw27xjzi7rd   51  opal requires Node 22 — 20 breaks the wasm loader  [code, build, opal]
```

Output is deliberately compact: full id (needed verbatim for `link` and
`forget`), strength 0–100, then the text. Ten results do not swamp a context
window. `--json` gives the full objects.

Conflicts:

```bash
ledger conflicts
# cc_msefwbrq3jl7px  divergent numbers, divergent times, divergent weekdays
#   A  m_msefwbr25obt3t  The weekly review runs Friday 16:00
#   B  m_msefwbrplk37ij  The weekly review runs Thursday 09:30

ledger judge cc_msefwbrq3jl7px --verdict conflict --kind "stale schedule" --detector 0.9
ledger judge cc_msefwbrq3jl7px --verdict unrelated    # settles the pair for good
```

Documents:

```bash
ledger ingest ./ops-handbook-v4.md --cluster proc --trust 0.86
your-pdf-tool report.pdf | ledger ingest - --cluster reading --trust 0.7
```

`.md`, `.txt`, `.csv`, `.json`, `.yaml` and similar are read directly; anything
needing a parser comes in on stdin.

## For humans

```bash
ledger serve                          # supervision UI on 127.0.0.1:7444
ledger review                         # the same queue, keyboard-driven
ledger search "cluster:code strength:>70"
ledger resolve cf_msefwpk5xrtzzy b    # a|b|both|merge|dismiss
ledger stats
ledger export "cluster:code" > code-memories.jsonl
```

`review` opens a terminal queue with the same keys as the web UI — `a` keep,
`e` edit, `d` drop, `p` pin for claims; `1`/`2`/`b`/`m`/`n` for conflicts, `tab`
to switch lane. Piped or non-interactive it prints the queue instead of taking
over the terminal, so `ledger review | head` does something sensible.

## Configuration

| | |
| --- | --- |
| `$LEDGER_DB` | Store location. Default `~/.ledger/ledger.db`. |
| `$LEDGER_AGENT` | Who is acting. Default `agent`. |
| `--db`, `--agent` | Override either per call. |
| `$NO_COLOR` | Disables ANSI colour. |

The store lives in `$HOME`, not in the skill directory, on purpose: a skill can
be installed per project, but memory is a property of the machine and its owner.
Two projects should not end up with two disjoint memories of the same person.

## Where it finds the UI

`serve` looks for built assets next to the bundled `cli.js` first (`./ui`), then
up in the workspace (`packages/ui/dist`). So an installed skill and a `bun run
dev` in the repo both work, with no configuration either way.
