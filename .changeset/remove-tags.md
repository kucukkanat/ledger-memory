---
'@ledger/core': minor
'@ledger/server': minor
'@ledger/cli': minor
---

Remove tags. Clusters already carry the taxonomy, and a second freeform one only
ever disagreed with the first — two ways to say where a memory belongs meant
neither could be trusted to be complete.

**Breaking.** Schema version goes to 2 and `memory_tags` is dropped on the next
open, so existing tag data is deleted. Nothing else in a store is touched.

- **`@ledger/core`** — `Memory.tags` and `WriteInput.tags` are gone, as is the
  `tags` key on `memories.update`. `memories.tag()` and `memories.tags()` are
  removed, `memories.facets()` no longer returns a `tag` bucket, and `tag:` is no
  longer a filter in the query language. Dropping a source still returns its
  surviving claims to the review queue — that re-review was always the real
  signal, and it no longer leaves an `orphaned-source` tag behind to say so.
- **`@ledger/server`** — `/api/facets` drops `tag` and `tags`; `PATCH
  /api/memories/:id` no longer accepts `tags`; `op: "tag"` on
  `/api/memories/bulk` is gone and now answers 400 as an unknown operation.
- **`@ledger/cli`** — `remember --tags` is removed, and `recall` prints
  `[cluster]` rather than `[cluster, tag, tag]`.
