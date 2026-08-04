import { beforeEach, describe, expect, test } from 'bun:test'
import { openStore, type Store } from '@ledger/core'
import { Hono } from 'hono'
import { createApi } from './api.ts'

let store: Store
let app: Hono

const get = async (path: string): Promise<Response> =>
  app.request(new Request(`http://localhost/api${path}`))

const send = async (method: string, path: string, body?: unknown): Promise<Response> =>
  app.request(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  )

const json = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>

const seed = (text: string, cluster = 'prefs', agent = 'wren') =>
  store.memories.write({ text, cluster, agent })._unsafeUnwrap()

beforeEach(() => {
  store = openStore({ path: ':memory:' })
  // Mounted exactly as the real server mounts it, so the prefix is under test too.
  app = new Hono().route('/api', createApi(store))
})

describe('reading', () => {
  test('stats reports the shape of the store', async () => {
    seed('Prefers metric units')
    const body = await json(await get('/stats'))
    expect(body['memories']).toBe(1)
    expect(body['pending']).toBe(1)
    expect((body['clusters'] as unknown[]).length).toBe(10)
  })

  test('search never counts as a retrieval', async () => {
    const m = seed('Prefers metric units in all outputs')
    await get('/search?q=metric')
    await get('/search?q=metric')
    expect(store.memories.get(m.id)._unsafeUnwrap().hits).toBe(0)
  })

  test('a bad filter answers 400 with an explanation', async () => {
    const response = await get('/search?q=asof:whenever')
    expect(response.status).toBe(400)
    expect(String((await json(response))['error'])).toContain('date')
  })

  test('a missing memory answers 404', async () => {
    expect((await get('/memories/m_nope')).status).toBe(404)
  })

  test('a memory comes back with its related memories', async () => {
    const a = seed('opal/parser panics on empty frontmatter', 'code', 'forge')
    const b = seed('opal/parser was rewritten in 2.3', 'code', 'forge')
    store.memories.link(a.id, b.id, 'forge')
    const body = await json(await get(`/memories/${a.id}`))
    expect((body['related'] as { id: string }[]).map((r) => r.id)).toContain(b.id)
  })
})

describe('review', () => {
  test('returns claims, conflicts and candidates in one call', async () => {
    seed('The weekly review runs Friday 16:00', 'proc')
    seed('The weekly review runs Thursday 09:30', 'proc')
    const body = await json(await get('/review'))
    expect((body['claims'] as unknown[]).length).toBe(2)
    expect((body['candidates'] as unknown[]).length).toBe(1)
  })

  test('keeping clears a claim from the queue', async () => {
    const m = seed('Prefers no preamble')
    expect((await send('POST', `/review/${m.id}/keep`)).status).toBe(200)
    expect((await json(await get('/review')))['claims']).toEqual([])
  })

  test('editing rewrites the text', async () => {
    const m = seed('Prefers metirc units')
    const body = await json(
      await send('POST', `/review/${m.id}/edit`, {
        text: 'Prefers metric units',
      }),
    )
    expect(body['text']).toBe('Prefers metric units')
  })

  test('an unknown action is rejected rather than ignored', async () => {
    const m = seed('Prefers metric units')
    expect((await send('POST', `/review/${m.id}/obliterate`)).status).toBe(400)
  })

  test('refuses to review a chunk individually', async () => {
    store.sources.ingest({
      filename: 'a.md',
      cluster: 'proc',
      agent: 'atlas',
      text: 'One.\n\nTwo.',
    })
    const chunk = store.memories.search({ query: '', kind: 'chunk' })._unsafeUnwrap().hits[0]
    if (!chunk) throw new Error('expected a chunk')
    const response = await send('POST', `/review/${chunk.id}/keep`)
    expect(response.status).toBe(400)
    expect(String((await json(response))['error'])).toContain('chunk')
  })
})

describe('conflicts', () => {
  const openOne = () => {
    seed('The weekly review runs Friday 16:00', 'proc')
    seed('The weekly review runs Thursday 09:30', 'proc')
    const candidate = store.conflicts.candidates()[0]
    if (!candidate) throw new Error('expected a candidate')
    const conflict = store.conflicts
      .judge({
        candidateId: candidate.id,
        agent: 'wren',
        verdict: 'conflict',
        kind: 'stale schedule',
      })
      ._unsafeUnwrap()
    if (!conflict) throw new Error('expected a conflict')
    return conflict
  }

  test('resolving retires the losing side', async () => {
    const conflict = openOne()
    expect(
      (
        await send('POST', `/conflicts/${conflict.id}/resolve`, {
          resolution: 'b',
        })
      ).status,
    ).toBe(200)
    expect(store.memories.get(conflict.a.id)._unsafeUnwrap().deletedAt).not.toBeNull()
  })

  test('a resolution is required, not defaulted', async () => {
    const conflict = openOne()
    expect((await send('POST', `/conflicts/${conflict.id}/resolve`, {})).status).toBe(400)
  })

  test('resolving an already-resolved conflict answers 404', async () => {
    const conflict = openOne()
    await send('POST', `/conflicts/${conflict.id}/resolve`, {
      resolution: 'dismiss',
    })
    expect(
      (
        await send('POST', `/conflicts/${conflict.id}/resolve`, {
          resolution: 'a',
        })
      ).status,
    ).toBe(404)
  })
})

describe('bulk operations', () => {
  test('pins a selection', async () => {
    const a = seed('one')
    const b = seed('two')
    const body = await json(await send('POST', '/memories/bulk', { op: 'pin', ids: [a.id, b.id] }))
    expect(body['affected']).toBe(2)
    expect(store.memories.get(a.id)._unsafeUnwrap().pinned).toBe(true)
  })

  test('exports as newline-delimited JSON with a filename', async () => {
    const a = seed('one')
    const response = await send('POST', '/memories/bulk', {
      op: 'export',
      ids: [a.id],
    })
    expect(response.headers.get('content-type')).toContain('ndjson')
    expect(response.headers.get('content-disposition')).toContain('ledger-export.jsonl')
    expect(JSON.parse(await response.text()).text).toBe('one')
  })

  test('an empty selection is rejected', async () => {
    expect((await send('POST', '/memories/bulk', { op: 'pin', ids: [] })).status).toBe(400)
  })

  test('an unknown operation is rejected', async () => {
    const a = seed('one')
    expect((await send('POST', '/memories/bulk', { op: 'nuke', ids: [a.id] })).status).toBe(400)
  })

  test('tagging requires a tag', async () => {
    const a = seed('one')
    expect((await send('POST', '/memories/bulk', { op: 'tag', ids: [a.id] })).status).toBe(400)
  })
})

describe('sources', () => {
  test('lists sources with a chunk preview and their distilled claims', async () => {
    const { source } = store.sources
      .ingest({
        filename: 'ops.md',
        cluster: 'proc',
        agent: 'atlas',
        text: '# Rotation\n\nRotate on Tuesday.\n\n# Freeze\n\nFreeze the index.',
      })
      ._unsafeUnwrap()
    store.memories.write({
      text: 'Rotate credentials on the first Tuesday after payday',
      cluster: 'proc',
      agent: 'atlas',
      sourceId: source.id,
    })

    const list = (await (await get('/sources')).json()) as {
      chunkPreview: unknown[]
      claimList: unknown[]
    }[]
    expect(list).toHaveLength(1)
    expect(list[0]?.chunkPreview.length).toBeGreaterThan(0)
    expect(list[0]?.claimList).toHaveLength(1)
  })

  test('retrusting a source is reflected in its chunks', async () => {
    const { source } = store.sources
      .ingest({
        filename: 'a.md',
        cluster: 'proc',
        agent: 'atlas',
        text: 'One.\n\nTwo.',
      })
      ._unsafeUnwrap()
    await send('POST', `/sources/${source.id}/trust`, { trust: 0.2 })
    expect(store.sources.chunks(source.id)[0]?.strength).toBeCloseTo(0.2, 10)
  })

  test('dropping removes chunks and reports what was flagged', async () => {
    const { source } = store.sources
      .ingest({
        filename: 'a.md',
        cluster: 'proc',
        agent: 'atlas',
        text: 'One.\n\nTwo.',
      })
      ._unsafeUnwrap()
    const body = await json(await send('DELETE', `/sources/${source.id}`))
    expect(Number(body['chunks'])).toBeGreaterThan(0)
    expect(store.sources.list()).toHaveLength(0)
  })
})

describe('graph', () => {
  test('returns nodes, links and the cluster palette in one call', async () => {
    const a = seed('opal/parser panics on empty frontmatter', 'code', 'forge')
    const b = seed('opal/parser was rewritten in 2.3', 'code', 'forge')
    store.memories.link(a.id, b.id, 'forge')

    const body = await json(await get('/graph'))
    expect((body['nodes'] as unknown[]).length).toBe(2)
    expect((body['links'] as unknown[]).length).toBe(1)
    expect((body['clusters'] as unknown[]).length).toBe(10)
  })

  test('excludes chunks unless asked, since they would swamp the view', async () => {
    seed('a claim')
    store.sources.ingest({
      filename: 'a.md',
      cluster: 'proc',
      agent: 'atlas',
      text: 'One.\n\nTwo.',
    })
    expect(((await json(await get('/graph')))['nodes'] as unknown[]).length).toBe(1)
    expect(
      ((await json(await get('/graph?chunks=1')))['nodes'] as unknown[]).length,
    ).toBeGreaterThan(1)
  })
})

describe('clusters', () => {
  test('creates a cluster and slugifies its id', async () => {
    const body = await json(await send('POST', '/clusters', { label: 'Client work' }))
    expect(body['id']).toBe('client-work')
  })

  test('requires a label', async () => {
    expect((await send('POST', '/clusters', {})).status).toBe(400)
  })
})
