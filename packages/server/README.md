# @ledger/server

The supervision server: the API the UI talks to, and the UI itself.

```bash
bun add @ledger/server
```

This is **not** how agents reach memory. They shell out to the bundled CLI,
which opens the SQLite file directly — so this process is something you start
when you want to *look* at your memory, and can leave stopped the rest of the
time without agents losing the ability to remember anything.

## Run it

```ts
import { createServer } from '@ledger/server'

const server = createServer({
  store: { path: './ledger.db' },
  port: 7444,
  ui: './skills/ledger-memory/ui',   // omit to run headless
})

const running = server.listen()
console.log(running.url)   // http://127.0.0.1:7444

await running.stop()
```

`host` defaults to `127.0.0.1`. That default is the entire privacy claim of the
project, so changing it should be a deliberate act.

## Routes

| Route | For |
| --- | --- |
| `/api/*` | The supervision UI |
| `GET /health` | Liveness |
| `/*` | The UI, with SPA fallback |

## Nothing here counts as retrieval

Every read through this API passes `countRead: false`. A human scrolling the
Browse table is not evidence that a memory is useful, and if it were, the act of
supervising the store would inflate the very numbers being supervised.

## API

```ts
await fetch('http://127.0.0.1:7444/api/search?q=' + encodeURIComponent('cluster:code strength:>70'))
// { hits: [...], total: 12, tookMs: 3.1, capped: false }

await fetch('http://127.0.0.1:7444/api/review')
// { claims: [...], conflicts: [...], candidates: [...] }

await fetch('http://127.0.0.1:7444/api/conflicts/cf_.../resolve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ resolution: 'b' }),
})
```

Bulk operations take an op and a selection:

```ts
await fetch('http://127.0.0.1:7444/api/memories/bulk', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ op: 'pin', ids: ['m_...', 'm_...'] }),
})
```

`op` is one of `pin`, `unpin`, `archive`, `unarchive`, `merge`, `drop`,
`export`. Export streams back JSONL as a file download rather than JSON.

Failures answer 400 or 404 with `{ error, kind }`, where `error` is written for
a person to read and the UI shows it verbatim.

## Embedding

`createApi(store)` returns a bare [Hono](https://hono.dev) app if you want to
mount the supervision routes into a larger server yourself. Mount it under
`/api` — the UI client assumes that prefix.
