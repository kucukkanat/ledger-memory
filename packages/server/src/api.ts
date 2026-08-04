import {
  type ConflictResolution,
  explain,
  type LedgerFailure,
  type SearchMode,
  type Store,
} from '@ledger/core'
import { Hono } from 'hono'
import type { Result } from 'neverthrow'

/**
 * The UI's REST surface.
 *
 * Distinct from the MCP surface in one way that matters: nothing here counts as
 * a retrieval. A human scrolling the Browse table must not inflate the `hits`
 * and `last read` numbers that same table is showing them.
 */

const status = (failure: LedgerFailure): 400 | 404 => {
  switch (failure.kind) {
    case 'unknown-memory':
    case 'unknown-source':
    case 'unknown-conflict':
    case 'unknown-candidate':
    case 'unknown-cluster':
      return 404
    default:
      return 400
  }
}

type Json = Record<string, unknown> | unknown[]

const send = <T extends Json>(result: Result<T, LedgerFailure>) =>
  result.match(
    (value) => ({ body: value as Json, code: 200 as const }),
    (failure) => ({
      body: { error: explain(failure), kind: failure.kind } as Json,
      code: status(failure),
    }),
  )

export const createApi = (store: Store) => {
  const api = new Hono()

  api.get('/stats', (c) => c.json({ ...store.stats(), clusters: store.clusters.list() }))

  api.get('/clusters', (c) => c.json(store.clusters.list()))

  api.post('/clusters', async (c) => {
    const body = (await c.req.json()) as {
      label?: string
      id?: string
      color?: string
    }
    if (!body.label) return c.json({ error: 'label is required' }, 400)
    const { body: out, code } = send(
      store.clusters.create({
        label: body.label,
        ...(body.id ? { id: body.id } : {}),
        ...(body.color ? { color: body.color } : {}),
      }),
    )
    return c.json(out, code)
  })

  api.get('/agents', (c) =>
    c.json({
      agents: store.agents.list().map((a) => ({ ...a, ...store.agents.activity(a.id) })),
      overlap: store.agents.overlap(),
    }),
  )

  api.get('/events', (c) => c.json(store.events(Number(c.req.query('limit') ?? 20))))

  api.get('/facets', (c) => c.json(store.memories.facets()))

  api.get('/timeline', (c) => c.json(store.timeline(Number(c.req.query('buckets') ?? 60))))

  api.get('/search', (c) => {
    const q = c.req.query()
    const { body, code } = send(
      store.memories.search({
        query: q['q'] ?? '',
        countRead: false,
        limit: Number(q['limit'] ?? 100),
        offset: Number(q['offset'] ?? 0),
        ...(q['mode'] ? { mode: q['mode'] as SearchMode } : {}),
        ...(q['kind'] ? { kind: q['kind'] as 'claim' | 'chunk' | 'all' } : {}),
        ...(q['sort'] ? { sort: q['sort'] as 'strength' | 'hits' | 'created' | 'last' } : {}),
        ...(q['dir'] ? { dir: q['dir'] as 'asc' | 'desc' } : {}),
        ...(q['archived'] === '1' ? { includeArchived: true } : {}),
        ...(q['pending'] === '1' ? { pendingOnly: true } : {}),
        ...(q['pinned'] === '1' ? { pinnedOnly: true } : {}),
        ...(q['conflicted'] === '1' ? { conflictedOnly: true } : {}),
      }),
    )
    return c.json(body, code)
  })

  api.get('/memories/:id', (c) => {
    const { body, code } = send(store.memories.get(c.req.param('id')))
    if (code !== 200) return c.json(body, code)
    return c.json({
      memory: body,
      related: store.memories.related(c.req.param('id'), 5),
    })
  })

  api.patch('/memories/:id', async (c) => {
    const patch = (await c.req.json()) as {
      text?: string
      cluster?: string
      by?: string
    }
    const { body, code } = send(
      store.memories.update(
        c.req.param('id'),
        {
          ...(patch.text !== undefined ? { text: patch.text } : {}),
          ...(patch.cluster !== undefined ? { cluster: patch.cluster } : {}),
        },
        patch.by ?? 'human',
      ),
    )
    return c.json(body, code)
  })

  /** Bulk operations from the Browse selection bar. */
  api.post('/memories/bulk', async (c) => {
    const body = (await c.req.json()) as {
      op: 'pin' | 'unpin' | 'archive' | 'unarchive' | 'merge' | 'drop' | 'export'
      ids: string[]
      by?: string
    }
    const by = body.by ?? 'human'
    const ids = body.ids ?? []
    if (ids.length === 0) return c.json({ error: 'no memories selected' }, 400)

    switch (body.op) {
      case 'pin':
      case 'unpin':
        return c.json({
          affected: store.memories.pin(ids, body.op === 'pin', by),
        })
      case 'archive':
      case 'unarchive':
        return c.json({
          affected: store.memories.archive(ids, body.op === 'archive', by),
        })
      case 'drop':
        return c.json({ affected: store.memories.remove(ids, by) })
      case 'merge': {
        const { body: out, code } = send(store.memories.merge(ids, by))
        return c.json(out, code)
      }
      case 'export':
        return new Response(store.memories.exportJsonl(ids), {
          headers: {
            'content-type': 'application/x-ndjson',
            'content-disposition': 'attachment; filename="ledger-export.jsonl"',
          },
        })
      default:
        return c.json({ error: `unknown operation "${String(body.op)}"` }, 400)
    }
  })

  api.get('/review', (c) =>
    c.json({
      claims: store.review.pending(Number(c.req.query('limit') ?? 50)),
      conflicts: store.conflicts.open(50),
      candidates: store.conflicts.candidates(20),
    }),
  )

  api.post('/review/:id/:action', async (c) => {
    const id = c.req.param('id')
    const action = c.req.param('action')
    const by = c.req.query('by') ?? 'human'

    if (action === 'keep') {
      const { body, code } = send(store.review.keep(id, by))
      return c.json(body, code)
    }
    if (action === 'pin') {
      const { body, code } = send(store.review.pin(id, by))
      return c.json(body, code)
    }
    if (action === 'drop') {
      const dropped = store.review.drop(id, by)
      return dropped.isOk()
        ? c.json({ dropped: id })
        : c.json({ error: explain(dropped.error) }, status(dropped.error))
    }
    if (action === 'edit') {
      const { text } = (await c.req.json()) as { text?: string }
      if (text === undefined) return c.json({ error: 'text is required' }, 400)
      const { body, code } = send(store.review.edit(id, text, by))
      return c.json(body, code)
    }
    return c.json({ error: `unknown review action "${action}"` }, 400)
  })

  api.post('/conflicts/:id/resolve', async (c) => {
    const { resolution, by } = (await c.req.json()) as {
      resolution?: ConflictResolution
      by?: string
    }
    if (!resolution) return c.json({ error: 'resolution is required' }, 400)
    const resolved = store.conflicts.resolve(c.req.param('id'), resolution, by ?? 'human')
    return resolved.isOk()
      ? c.json({ resolved: c.req.param('id'), resolution })
      : c.json({ error: explain(resolved.error) }, status(resolved.error))
  })

  api.get('/sources', (c) =>
    c.json(
      store.sources.list().map((s) => ({
        ...s,
        chunkPreview: store.sources.chunks(s.id, 4),
        claimList: store.sources.claims(s.id),
      })),
    ),
  )

  api.post('/sources/:id/trust', async (c) => {
    const { trust, by } = (await c.req.json()) as {
      trust?: number
      by?: string
    }
    if (typeof trust !== 'number') return c.json({ error: 'trust must be a number 0..1' }, 400)
    const updated = store.sources.trust(c.req.param('id'), trust, by ?? 'human')
    return updated.isOk()
      ? c.json({ id: c.req.param('id'), trust })
      : c.json({ error: explain(updated.error) }, status(updated.error))
  })

  api.delete('/sources/:id', (c) => {
    const { body, code } = send(store.sources.drop(c.req.param('id'), c.req.query('by') ?? 'human'))
    return c.json(body, code)
  })

  /** Everything the canvas needs to draw, in one call. */
  api.get('/graph', (c) => {
    const q = c.req.query()
    const found = store.memories.search({
      query: q['q'] ?? '',
      limit: Number(q['limit'] ?? 4000),
      countRead: false,
      // Claims unless asked otherwise — chunks outnumber them several to one
      // and bury the shape of what the fleet knows.
      kind: (q['kind'] as 'claim' | 'chunk' | 'all' | undefined) ?? 'claim',
      // The same supervision filters the table takes, so the two screens can
      // share one filter rail and mean the same thing by it.
      ...(q['archived'] === '1' ? { includeArchived: true } : {}),
      ...(q['pending'] === '1' ? { pendingOnly: true } : {}),
      ...(q['pinned'] === '1' ? { pinnedOnly: true } : {}),
      ...(q['conflicted'] === '1' ? { conflictedOnly: true } : {}),
    })
    if (found.isErr()) return c.json({ error: explain(found.error) }, status(found.error))

    const ids = new Set(found.value.hits.map((m) => m.id))
    const links = (
      store.db.query('SELECT a, b FROM links').all() as {
        a: string
        b: string
      }[]
    ).filter((l) => ids.has(l.a) && ids.has(l.b))

    return c.json({
      nodes: found.value.hits.map((m) => ({
        id: m.id,
        text: m.text,
        cluster: m.clusterId,
        color: m.clusterColor,
        writer: m.writer,
        strength: m.strength,
        hits: m.hits,
        createdAt: m.createdAt,
        pinned: m.pinned,
        conflict: m.conflictWith !== null,
        kind: m.kind,
      })),
      links,
      clusters: store.clusters.list(),
      capped: found.value.capped,
    })
  })

  return api
}
