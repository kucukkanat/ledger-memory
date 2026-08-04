# @ledger/ui

The supervision interface: five screens over a LEDGER store.

```bash
bun run --filter '@ledger/ui' fonts:vendor   # self-host the typefaces, once
bun run --filter '@ledger/ui' build
```

`@ledger/server` serves the built output. For UI work, `bun run dev` starts Vite
on port 7445 and proxies `/api` to a server on 7444.

## The screens

**Review** — what your agents learned since you last looked, in two lanes.
Claims get keep / edit / drop / pin (`a` `e` `d` `p`); conflicts get keep A /
keep B / keep both / merge / not-a-conflict (`1` `2` `b` `m` `n`). Arrow keys or
`j`/`k` move, `tab` switches lane. The queue is an audit, not a gate — pending
claims are already searchable, so an unworked queue never blocks an agent.

**Browse** — every memory, filterable and operable in bulk. Facet clicks write
into the query string rather than into separate state, so the search box always
describes exactly what the table is showing and you can read, edit or copy it.

**Sources** — the documents behind the chunks, with a trust slider that moves
every chunk at once. Expanding a source shows its first chunks and the claims
agents distilled from it.

**Canvas** — four layouts over the same memories, eased between so you can see
it is the same set rearranged. `clusters` (what is known, by topic), `graph`
(what links to what), `time` (how knowledge accumulated, banded by cluster) and
`heat` (retrieval against strength — top right is load-bearing, bottom left is
dead weight). The scrubber replays the store's history; ⏵ plays it.

**Connections** — which agents are attached, what they read and write, what they
have in common, and a live request feed.

## Conventions

Search from this UI never counts as retrieval. A human scrolling a table is not
evidence that a memory is useful, and if it were, supervising the store would
inflate the numbers being supervised.

Errors are shown verbatim. The server writes them for a person to read, so
replacing them with "something went wrong" would throw away the only useful part.

Styling comes from [`@ledger/tokens`](../tokens) — CSS custom properties in the
DOM, the TypeScript palette on the canvas. No colour is written twice.

## Embedding

```tsx
import { App } from '@ledger/ui'
import '@ledger/ui/app.css'
```

The app assumes a LEDGER API at `/api` on the same origin.
