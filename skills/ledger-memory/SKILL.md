---
name: ledger-memory
description: Remember things across sessions using LEDGER, a local memory store on this machine shared with other agents. Recall before answering anything about the user, their preferences, their projects, their people, or their history — the answer is often already stored from an earlier session. Remember durable facts when you learn them. Also covers judging suspected contradictions between memories, ingesting documents as searchable sources, and asof time-travel queries. Use when the user says "remember this", "what do you know about", "did I tell you", when you need context that predates this conversation, or when something you were told contradicts something you already know.
---

# LEDGER

LEDGER is the long-term memory for this machine. It is a local SQLite store,
shared with the other agents here, and a human reads everything you write.

Everything runs through one bundled command. Nothing goes over a network.

## The command

```bash
bun "$LEDGER" --help
```

`$LEDGER` is `cli.js` in this skill's directory. Set it once at the start of a
session:

```bash
LEDGER="$(find ~/.claude/skills .claude/skills -name cli.js -path '*ledger-memory*' 2>/dev/null | head -1)"
LEDGER="$(cd "$(dirname "$LEDGER")" && pwd)/cli.js"
```

The second line makes it absolute, so it keeps working after you `cd`. If the
first line comes back empty the skill is not installed properly — say so rather
than guessing at a path.

Identify yourself once, so the human can see which agent wrote what:

```bash
export LEDGER_AGENT=claude
```

## Recall before you answer

Before answering anything about the user — preferences, projects, people,
history, how they like things done — recall first. Another agent, or an earlier
you, has probably already learned it.

```bash
bun "$LEDGER" recall "invoice terms brightpath"
```

```
2 memories
m_msdvpyg9lkdujq   84  Brightpath invoices net-45 in the 2026 contract  [money, invoice]
m_msdvpyi6f2x7zr   51  Brightpath pays late by about nine days  [money, invoice]
```

The number is **strength**, 0–100: how much the store trusts that memory,
recomputed on every read from how often it is retrieved, how recently, and how
many independent sources back it. Prefer the strong ones.

One command routinely saves you from asking the user something they have
already told you twice.

## Remember what will still matter next week

```bash
bun "$LEDGER" remember "Brightpath moved to net-45 in the 2026 contract" \
  --cluster money --note "confirmed by follow-up question"
```

A good memory is **one self-contained sentence**. It gets read months from now
with none of this conversation around it, so it has to stand on its own.

| Remember this | Not this |
| --- | --- |
| `Prefers metric units in all outputs` | `They said metric is fine` |
| `opal requires Node 22 — 20 breaks the wasm loader` | `Fixed the build` |
| `Mara Ostrowski is design lead at Halden, met at the Lisbon offsite` | `Talked to Mara` |
| `The weekly review runs Friday 16:00, timeboxed to 25 minutes` | `Meeting moved` |

Remember: preferences, decisions and the reasoning behind them, constraints,
people and their roles, procedures, recurring commitments, hard-won gotchas.

Do **not** remember: what happened in this conversation, anything the user asked
you to keep out of memory, secrets, credentials, API keys, or anything that will
be stale tomorrow. When unsure whether something is too sensitive to store, ask.

Run `bun "$LEDGER" clusters` once before your first write so you file things
where the user expects to find them. If nothing fits, say so rather than forcing
it into the nearest cluster.

## When something changed, supersede — never overwrite

Write the new fact as its own memory. Do not edit the old one, and do not
quietly drop it:

```bash
bun "$LEDGER" remember "The weekly review moved to Thursday 09:30" --cluster proc
```

The store notices the contradiction and queues it for the human. Deciding which
of two beliefs survives is their call, not yours.

Use `forget` only for things that were wrong or are genuinely finished:

```bash
bun "$LEDGER" forget m_msdvpyg9lkdujq
```

Forgotten memories stay answerable by `asof:` queries, so the history of what was
believed stays intact.

## Judge conflicts; do not resolve them

The store spots pairs that look like they disagree — same subject, different
number, date, or a negation on one side. It cannot tell a real contradiction
from a coincidence, so it asks you:

```bash
bun "$LEDGER" conflicts
```

```
cc_msdvpyi8r1tj4u  divergent numbers, divergent times, divergent weekdays
  A  m_msdvpyg9lkdujq  The weekly review runs Friday 16:00
  B  m_msdvpyi6f2x7zr  The weekly review runs Thursday 09:30
```

For each pair, decide whether both can be true at once:

```bash
# They cannot — queue it for the human
bun "$LEDGER" judge cc_msdvpyi8r1tj4u --verdict conflict \
  --kind "stale schedule" --detector 0.9 --note "the schedule moved"

# They can — settles the pair for good, never proposed again
bun "$LEDGER" judge cc_msdvpyi8r1tj4u --verdict unrelated
```

`--detector` is how sure *you* are, 0 to 1. Be honest: the human uses it to
decide how much to trust the flag.

Kinds: `direct contradiction`, `value drift`, `stale schedule`, `stale terms`,
`date conflict`, `stale fact`.

Do this when you have spare turns — after finishing a task, not in the middle of
one. There is no command to resolve a conflict, deliberately; that is the
human's decision.

## Documents: chunks and claims are different things

```bash
bun "$LEDGER" ingest ./ops-handbook-v4.md --cluster proc --trust 0.86
```

`.md`, `.txt`, `.csv`, `.json`, `.yaml` and similar are read directly. For a PDF
or a docx, extract the text yourself and pipe it in:

```bash
your-pdf-tool report.pdf | bun "$LEDGER" ingest - --cluster reading --trust 0.7
```

This produces **chunks** — searchable slices that inherit the document's trust,
never decay, and are never reviewed one at a time. The human trusts or drops the
whole document.

If the document asserts something worth remembering on its own, follow up with
`remember`. That becomes a **claim**, and claims do get reviewed. Ingesting a
document is not the same as learning from it.

## Retrieval is what keeps a memory alive

Every `recall` raises the strength of what it returns; memories nothing reads
decay and eventually stop surfacing. So recalling is not just how you find
things — it is how the store learns what is worth keeping. A memory that is
never retrieved is one the store is right to forget.

## Filters

Free text plus any of these, in the same string:

```
agent:forge          written or read by that agent
cluster:code         topic cluster
type:chat|doc        said in conversation, or from a document
kind:claim|chunk     assertions, or document slices
strength:<40         fading    (also strength:>70 for load-bearing)
asof:2026-01-01      what the store knew then, forgotten memories included
after:30d            last 30 days (also 2w, 6mo, 1y, or a date)
before:2026-06-01
```

```bash
bun "$LEDGER" recall "node cluster:code strength:>70"
bun "$LEDGER" recall "kestrel asof:2026-01-01"
```

`asof:` is the one worth remembering. Forgotten memories are kept, so it answers
"what did we believe back then" — useful when the user asks why a past decision
looked right at the time. It takes a date or a full ISO instant.

## Things that are not yours to do

`search`, `review`, `serve`, `resolve` and `export` are the human's commands.
`search` deliberately does not count as a retrieval — do not use it as a
substitute for `recall`. If the user wants to look through their memory
themselves, tell them:

```bash
bun "$LEDGER" serve       # supervision UI on http://127.0.0.1:7444
bun "$LEDGER" review      # work the queue in the terminal
```

## This is not the only memory

If the user also keeps hand-written markdown memories (`~/.claude/**/memory/`
with a `MEMORY.md` index), that system is separate and stays that way. Those
files are durable, curated facts the user wrote deliberately. LEDGER is for what
*agents* learn: higher volume, decaying, reviewed. Do not copy between them
unless the user asks.
