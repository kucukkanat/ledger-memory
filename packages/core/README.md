# @ledger/core

The LEDGER store: SQLite with FTS5, computed strength, a query language, conflict
candidate detection, and document ingestion. No server, no transport — just the
memory model.

```bash
bun add @ledger/core
```

## Open a store

```ts
import { openStore } from '@ledger/core'

const store = openStore({ path: './ledger.db' })
```

`:memory:` gives you a throwaway store. Pass `clock` to control time — every
timestamp in the store comes from it, which is what makes decay testable:

```ts
let now = Date.parse('2026-01-01T00:00:00Z')
const store = openStore({ path: ':memory:', clock: () => now })
```

## Write and read

Fallible operations return a `Result` from [neverthrow](https://github.com/supermacro/neverthrow),
so a failure cannot be ignored by accident.

```ts
const written = store.memories.write({
  text: 'opal requires Node 22 — 20 breaks the wasm loader',
  cluster: 'code',
  agent: 'forge',
  tags: ['opal', 'build'],
  provenance: 'confirmed by follow-up question',
})

if (written.isErr()) {
  console.error(explain(written.error))   // "No cluster "code". Known clusters: …"
} else {
  console.log(written.value.strength)     // 0.51 — new, unread, single source
}
```

Searching returns hits ranked by relevance, with strength breaking ties:

```ts
const found = store.memories.search({
  query: 'node wasm cluster:code',
  agent: 'forge',
  countRead: true,   // this is an agent retrieving; it feeds `used` and `fresh`
  limit: 10,
})

for (const hit of found._unsafeUnwrap().hits) {
  console.log(Math.round(hit.strength * 100), hit.text)
}
```

`countRead: false` is the supervision path — the UI reads without inflating the
numbers it is showing you.

## Strength

Never stored, always recomputed. Every memory carries the three factors behind
its number so a UI can explain itself:

```ts
const memory = store.memories.get(id)._unsafeUnwrap()

memory.strength      // 0.72
memory.factors       // { used: 0.41, fresh: 0.93, corroborated: 0.33 }
```

The pure functions are exported if you want to reason about decay without a
store — `daysUntil` answers "how long until this fades":

```ts
import { daysUntil, factorsOf, strengthOf } from '@ledger/core'

const input = { hits: 20, lastReadAt: Date.now(), sourceCount: 1, readerCount: 2, now: Date.now() }
strengthOf(factorsOf(input))   // 0.68
daysUntil(input, 0.4)          // 216 — days of neglect before it drops to 40
```

Chunks bypass all of this: `chunkStrength(sourceTrust)` is their whole story.

## Conflicts

The store proposes; an agent decides.

```ts
store.memories.write({ text: 'The weekly review runs Friday 16:00', cluster: 'proc', agent: 'wren' })
store.memories.write({ text: 'The weekly review runs Thursday 09:30', cluster: 'proc', agent: 'atlas' })

const [candidate] = store.conflicts.candidates()
candidate.signals   // ['divergent numbers', 'divergent times', 'divergent weekdays']

store.conflicts.judge({
  candidateId: candidate.id,
  agent: 'wren',
  verdict: 'conflict',
  kind: 'stale schedule',
  detector: 0.88,
})

const [conflict] = store.conflicts.open()
store.conflicts.resolve(conflict.id, 'b', 'human')   // keep B, retire A
```

Resolutions are `'a' | 'b' | 'both' | 'merge' | 'dismiss'`. `both` links the two
as related, `merge` folds B's text into A while keeping A's accumulated
evidence, `dismiss` records that the detector was wrong.

The suspicion heuristic is exported and pure, if you want to test or replace it:

```ts
import { suspect } from '@ledger/core'

suspect('Renews every 12 months', 'Renews every 24 months')
// { score: 0.73, signals: ['divergent numbers'] }
suspect('Kestrel ships Sep 14', 'The router runs firmware 3.4')
// null — different subjects, not worth an agent's attention
```

## Documents

```ts
const { source, chunks } = store.sources
  .ingest({
    filename: 'ops-handbook-v4.md',
    cluster: 'proc',
    agent: 'atlas',
    text: await Bun.file('./ops-handbook-v4.md').text(),
    trust: 0.86,
  })
  ._unsafeUnwrap()

// Chunks are searchable now, at strength 0.86, and never enter the review queue.
// A claim distilled from the document does:
store.memories.write({
  text: 'Rotate credentials on the first Tuesday after payday',
  cluster: 'proc',
  agent: 'atlas',
  sourceId: source.id,
})

store.sources.drop(source.id, 'human')
// → { chunks: 3, flagged: 1 } — chunks gone, the claim kept but flagged
```

`readSourceFile` handles `.md`, `.txt`, `.csv`, `.json`, `.yaml` and friends, and
returns a typed failure telling you to extract the text yourself for anything
that needs a parser.

## Time travel

Deletes are soft, so the store can answer what it believed on a date — including
memories dropped since, and including full-text queries:

```ts
store.memories.remove([id], 'human')

store.memories.search({ query: 'passport' })                    // 0 hits
store.memories.search({ query: 'passport asof:2026-03-01' })    // still there
```

`asof:` accepts a date or a full ISO instant.

## Query language

`parseQuery` is pure and exported, if you want to inspect or extend it:

```ts
import { parseQuery } from '@ledger/core'

parseQuery('node 22 cluster:code strength:<40 after:30d', Date.now())._unsafeUnwrap()
// { terms: ['node', '22'], cluster: ['code'], strength: { op: '<', value: 0.4 }, after: … }
```

Repeating a key widens rather than narrows: `agent:wren agent:forge` means
either.

## Notes on scale

Ranking happens in TypeScript over a bounded window of `SCAN_LIMIT` (5,000)
rows, because strength is a function of the current time and cannot be sorted in
SQL. When the window fills, `SearchResult.capped` is `true` — results say so
rather than silently pretending to be the whole answer.

Conflict candidates are proposed against at most `CANDIDATE_COMPARISONS` (500)
recently-touched claims in the same cluster. An unbounded pairwise sweep on
every write is how a memory store becomes unusable.
