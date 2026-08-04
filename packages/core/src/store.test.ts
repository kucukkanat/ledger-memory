import { beforeEach, describe, expect, test } from 'bun:test'
import { openStore, type Store } from './store.ts'
import { PINNED_STRENGTH } from './strength.ts'

const DAY = 86_400_000
const T0 = Date.parse('2026-08-03T09:00:00Z')

/** A store with a clock the test drives, so decay is deterministic. */
const makeStore = () => {
  let now = T0
  const store = openStore({ path: ':memory:', clock: () => now })
  return {
    store,
    advance: (days: number): void => {
      now += days * DAY
    },
    set: (at: number): void => {
      now = at
    },
  }
}

const write = (
  store: Store,
  text: string,
  overrides: Partial<{ cluster: string; agent: string }> = {},
) =>
  store.memories
    .write({
      text,
      cluster: overrides.cluster ?? 'prefs',
      agent: overrides.agent ?? 'wren',
    })
    ._unsafeUnwrap()

let ctx: ReturnType<typeof makeStore>
let store: Store

beforeEach(() => {
  ctx = makeStore()
  store = ctx.store
})

describe('setup', () => {
  test('seeds the starting taxonomy', () => {
    const ids = store.clusters.list().map((c) => c.id)
    expect(ids).toContain('prefs')
    expect(ids).toContain('code')
    expect(ids.length).toBe(10)
  })

  test('can skip seeding for a store that brings its own taxonomy', () => {
    const bare = openStore({ path: ':memory:', seed: false })
    expect(bare.clusters.list()).toEqual([])
    bare.close()
  })

  test('accepts a new cluster and rejects writes to an unknown one', () => {
    const created = store.clusters.create({ label: 'Client work' })._unsafeUnwrap()
    expect(created.id).toBe('client-work')
    expect(store.memories.write({ text: 'x', cluster: 'client-work', agent: 'wren' }).isOk()).toBe(
      true,
    )

    const failure = store.memories
      .write({ text: 'x', cluster: 'nope', agent: 'wren' })
      ._unsafeUnwrapErr()
    expect(failure.kind).toBe('unknown-cluster')
    if (failure.kind === 'unknown-cluster') expect(failure.known).toContain('prefs')
  })
})

describe('writing', () => {
  test('a new claim is pending, unreviewed and immediately searchable', () => {
    const m = write(store, 'Prefers metric units in all outputs')
    expect(m.kind).toBe('claim')
    expect(m.reviewedAt).toBeNull()
    expect(store.review.pending().map((p) => p.id)).toContain(m.id)

    const found = store.memories.search({ query: 'metric units' })._unsafeUnwrap()
    expect(found.hits.map((h) => h.id)).toContain(m.id)
  })

  test('rejects empty text rather than storing a blank memory', () => {
    expect(
      store.memories.write({ text: '   ', cluster: 'prefs', agent: 'wren' })._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'invalid-input' })
  })

  test('registers the writing agent on first sight', () => {
    write(store, 'something', { agent: 'forge' })
    expect(store.agents.list().map((a) => a.id)).toContain('forge')
  })

  test('records the writer as its first reader, which seeds corroboration', () => {
    const m = write(store, 'Prefers ISO dates')
    expect(m.readers).toEqual(['wren'])
  })

  test('an explicit supersedes opens a conflict with full detector confidence', () => {
    const old = write(store, 'Brightpath invoices net-30')
    store.memories.write({
      text: 'Brightpath moved to net-45 in the 2026 contract',
      cluster: 'prefs',
      agent: 'atlas',
      supersedes: old.id,
    })
    const open = store.conflicts.open()
    expect(open).toHaveLength(1)
    expect(open[0]?.detector).toBe(1)
    expect(open[0]?.a.id).toBe(old.id)
  })
})

describe('retrieval and strength', () => {
  test('an agent search counts as retrieval; a UI search does not', () => {
    const m = write(store, 'Prefers metric units in all outputs')

    store.memories.search({ query: 'metric', agent: 'wren', countRead: false })
    expect(store.memories.get(m.id)._unsafeUnwrap().hits).toBe(0)

    store.memories.search({ query: 'metric', agent: 'forge', countRead: true })
    const after = store.memories.get(m.id)._unsafeUnwrap()
    expect(after.hits).toBe(1)
    expect(after.readers).toContain('forge')
  })

  test('strength decays with time and recovers when an agent reads it again', () => {
    const m = write(store, 'Prefers metric units in all outputs')
    const fresh = store.memories.get(m.id)._unsafeUnwrap().strength

    ctx.advance(400)
    const stale = store.memories.get(m.id)._unsafeUnwrap().strength
    expect(stale).toBeLessThan(fresh)

    store.memories.countReads([m.id], 'forge')
    const revived = store.memories.get(m.id)._unsafeUnwrap().strength
    expect(revived).toBeGreaterThan(stale)
  })

  test('a pinned claim is held at full strength regardless of neglect', () => {
    const m = write(store, 'Passport valid to 2036-02')
    store.memories.pin([m.id], true, 'tolga')
    ctx.advance(1000)
    expect(store.memories.get(m.id)._unsafeUnwrap().strength).toBe(PINNED_STRENGTH)
  })

  test('corroboration by a second agent raises strength without any new reads', () => {
    const m = write(store, 'The router runs on the guest VLAN', {
      cluster: 'home',
    })
    const before = store.memories.get(m.id)._unsafeUnwrap()
    store.memories.countReads([m.id], 'atlas')
    const after = store.memories.get(m.id)._unsafeUnwrap()
    expect(after.factors.corroborated).toBeGreaterThan(before.factors.corroborated)
  })
})

describe('search', () => {
  beforeEach(() => {
    write(store, 'Prefers metric units in all outputs')
    write(store, 'Wants dates written as 2026-08-03, never 8/3/26')
    write(store, 'opal/parser panics on empty frontmatter', {
      cluster: 'code',
      agent: 'forge',
    })
  })

  test('finds by keyword', () => {
    const r = store.memories.search({ query: 'frontmatter' })._unsafeUnwrap()
    expect(r.total).toBe(1)
    expect(r.hits[0]?.text).toContain('frontmatter')
  })

  test('hybrid mode recovers from a typo that keyword mode misses', () => {
    const typo = 'frontmater'
    expect(store.memories.search({ query: typo, mode: 'keyword' })._unsafeUnwrap().total).toBe(0)
    expect(
      store.memories.search({ query: typo, mode: 'hybrid' })._unsafeUnwrap().total,
    ).toBeGreaterThan(0)
  })

  test('filters by cluster and agent', () => {
    expect(store.memories.search({ query: 'cluster:code' })._unsafeUnwrap().total).toBe(1)
    expect(store.memories.search({ query: 'agent:forge' })._unsafeUnwrap().total).toBe(1)
  })

  test('returns everything when the query is only filters', () => {
    expect(store.memories.search({ query: '' })._unsafeUnwrap().total).toBe(3)
  })

  test('reports a bad filter instead of silently returning nothing', () => {
    expect(store.memories.search({ query: 'asof:whenever' })._unsafeUnwrapErr().kind).toBe(
      'invalid-query',
    )
  })

  test('strength bounds filter on the computed value', () => {
    ctx.advance(700)
    const weak = store.memories.search({ query: 'strength:<40' })._unsafeUnwrap()
    expect(weak.total).toBe(3)
    expect(store.memories.search({ query: 'strength:>40' })._unsafeUnwrap().total).toBe(0)
  })

  test('paginates without changing the reported total', () => {
    const page = store.memories.search({ query: '', limit: 2, offset: 0 })._unsafeUnwrap()
    expect(page.hits).toHaveLength(2)
    expect(page.total).toBe(3)
    expect(
      store.memories.search({ query: '', limit: 2, offset: 2 })._unsafeUnwrap().hits,
    ).toHaveLength(1)
  })

  test('excludes archived memories unless asked', () => {
    const [first] = store.memories.search({ query: '' })._unsafeUnwrap().hits
    if (!first) throw new Error('expected a memory')
    store.memories.archive([first.id], true, 'tolga')
    expect(store.memories.search({ query: '' })._unsafeUnwrap().total).toBe(2)
    expect(store.memories.search({ query: '', includeArchived: true })._unsafeUnwrap().total).toBe(
      3,
    )
  })
})

describe('time travel', () => {
  test('asof answers what the store knew then, including memories dropped since', () => {
    const january = Date.parse('2026-01-01T00:00:00Z')
    ctx.set(january)
    const old = write(store, 'Kestrel ships Aug 28 per the exec update', {
      cluster: 'projects',
    })

    ctx.set(T0)
    write(store, 'Kestrel moved to Sep 14 after the security review', {
      cluster: 'projects',
    })
    store.memories.remove([old.id], 'tolga')

    const today = store.memories.search({ query: 'kestrel' })._unsafeUnwrap()
    expect(today.hits.map((h) => h.id)).not.toContain(old.id)

    const then = store.memories.search({ query: 'kestrel asof:2026-02-01' })._unsafeUnwrap()
    expect(then.hits.map((h) => h.id)).toContain(old.id)
  })

  test('a text search at an earlier asof still reaches a dropped memory', () => {
    // Regression: soft delete used to evict the row from the FTS index, which
    // made every text query invisible to time travel — the one thing asof: is for.
    const january = Date.parse('2026-01-01T00:00:00Z')
    ctx.set(january)
    const old = write(store, 'Passport expires 2029-04', { cluster: 'travel' })

    ctx.set(T0)
    store.memories.remove([old.id], 'tolga')

    expect(store.memories.search({ query: 'passport' })._unsafeUnwrap().total).toBe(0)
    const then = store.memories.search({ query: 'passport asof:2026-03-01' })._unsafeUnwrap()
    expect(then.hits.map((h) => h.id)).toContain(old.id)
  })

  test('asof hides memories written after the cutoff', () => {
    write(store, 'Prefers tables over prose')
    const then = store.memories.search({ query: 'asof:2026-01-01' })._unsafeUnwrap()
    expect(then.total).toBe(0)
  })
})

describe('review', () => {
  test('keeping marks a claim reviewed and clears it from the queue', () => {
    const m = write(store, 'Prefers no preamble')
    store.review.keep(m.id, 'tolga')._unsafeUnwrap()
    expect(store.review.pending()).toHaveLength(0)
    expect(store.memories.get(m.id)._unsafeUnwrap().reviewedAt).not.toBeNull()
  })

  test('dropping removes it from search but keeps it answerable by asof', () => {
    const m = write(store, 'Prefers emoji in summaries')
    store.review.drop(m.id, 'tolga')._unsafeUnwrap()
    expect(store.memories.search({ query: 'emoji' })._unsafeUnwrap().total).toBe(0)
    expect(store.memories.get(m.id)._unsafeUnwrap().deletedAt).not.toBeNull()
  })

  test('editing corrects the text and reindexes it for search', () => {
    const m = write(store, 'Prefers metirc units')
    store.review.edit(m.id, 'Prefers metric units', 'tolga')._unsafeUnwrap()
    const found = store.memories.search({ query: 'metric', mode: 'keyword' })._unsafeUnwrap()
    expect(found.total).toBe(1)
    expect(store.memories.search({ query: 'metirc', mode: 'keyword' })._unsafeUnwrap().total).toBe(
      0,
    )
  })

  test('refuses to review a chunk one at a time', () => {
    store.sources
      .ingest({
        filename: 'handbook.md',
        cluster: 'proc',
        agent: 'atlas',
        text: 'A paragraph.\n\nAnother.',
      })
      ._unsafeUnwrap()
    const chunk = store.memories.search({ query: '', kind: 'chunk' })._unsafeUnwrap().hits[0]
    if (!chunk) throw new Error('expected a chunk')
    expect(store.review.keep(chunk.id, 'tolga')._unsafeUnwrapErr()).toMatchObject({
      kind: 'not-a-claim',
    })
  })

  test('chunks never appear in the review queue', () => {
    store.sources
      .ingest({
        filename: 'handbook.md',
        cluster: 'proc',
        agent: 'atlas',
        text: 'A.\n\nB.\n\nC.',
      })
      ._unsafeUnwrap()
    expect(store.review.pending()).toHaveLength(0)
  })
})

describe('conflicts', () => {
  test('the server proposes candidates but opens no conflict on its own', () => {
    write(store, 'The thermostat holds 19°C overnight', { cluster: 'home' })
    write(store, 'The thermostat overnight setpoint is 17.5°C now', {
      cluster: 'home',
    })

    expect(store.conflicts.open()).toHaveLength(0)
    const candidates = store.conflicts.candidates()
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.signals).toContain('divergent numbers')
  })

  test('an agent judging a candidate a conflict opens one', () => {
    write(store, 'The thermostat holds 19°C overnight', { cluster: 'home' })
    write(store, 'The thermostat overnight setpoint is 17.5°C now', {
      cluster: 'home',
    })
    const candidate = store.conflicts.candidates()[0]
    if (!candidate) throw new Error('expected a candidate')

    store.conflicts
      .judge({
        candidateId: candidate.id,
        agent: 'wren',
        verdict: 'conflict',
        kind: 'value drift',
        detector: 0.82,
      })
      ._unsafeUnwrap()

    const open = store.conflicts.open()
    expect(open).toHaveLength(1)
    expect(open[0]?.kind).toBe('value drift')
    expect(store.conflicts.candidates()).toHaveLength(0)
  })

  test('an agent judging a candidate unrelated settles it without a conflict', () => {
    write(store, 'The thermostat holds 19°C overnight', { cluster: 'home' })
    write(store, 'The thermostat overnight setpoint is 17.5°C now', {
      cluster: 'home',
    })
    const candidate = store.conflicts.candidates()[0]
    if (!candidate) throw new Error('expected a candidate')

    expect(
      store.conflicts
        .judge({
          candidateId: candidate.id,
          agent: 'wren',
          verdict: 'unrelated',
        })
        ._unsafeUnwrap(),
    ).toBeNull()
    expect(store.conflicts.candidates()).toHaveLength(0)
    expect(store.conflicts.open()).toHaveLength(0)
  })

  test('a judged candidate cannot be judged twice', () => {
    write(store, 'The thermostat holds 19°C overnight', { cluster: 'home' })
    write(store, 'The thermostat overnight setpoint is 17.5°C now', {
      cluster: 'home',
    })
    const candidate = store.conflicts.candidates()[0]
    if (!candidate) throw new Error('expected a candidate')
    store.conflicts.judge({
      candidateId: candidate.id,
      agent: 'wren',
      verdict: 'unrelated',
    })
    expect(
      store.conflicts
        .judge({
          candidateId: candidate.id,
          agent: 'wren',
          verdict: 'unrelated',
        })
        ._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'unknown-candidate' })
  })

  const openConflict = () => {
    const a = write(store, 'The weekly review runs Friday 16:00', {
      cluster: 'proc',
    })
    const b = write(store, 'The weekly review runs Thursday 09:30', {
      cluster: 'proc',
    })
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
    return { a, b, conflict }
  }

  test('keeping one side retires the other', () => {
    const { conflict } = openConflict()
    store.conflicts.resolve(conflict.id, 'b', 'tolga')._unsafeUnwrap()
    expect(store.memories.get(conflict.a.id)._unsafeUnwrap().deletedAt).not.toBeNull()
    expect(store.memories.get(conflict.b.id)._unsafeUnwrap().deletedAt).toBeNull()
    expect(store.conflicts.open()).toHaveLength(0)
  })

  test('keeping both links them as related rather than contradictory', () => {
    const { conflict } = openConflict()
    store.conflicts.resolve(conflict.id, 'both', 'tolga')._unsafeUnwrap()
    expect(store.memories.get(conflict.a.id)._unsafeUnwrap().deletedAt).toBeNull()
    expect(store.memories.get(conflict.b.id)._unsafeUnwrap().deletedAt).toBeNull()
    expect(store.memories.related(conflict.a.id).map((r) => r.id)).toContain(conflict.b.id)
  })

  test('merging folds the newer text into the older memory and keeps its evidence', () => {
    const { conflict } = openConflict()
    store.memories.countReads([conflict.a.id], 'atlas')
    const before = store.memories.get(conflict.a.id)._unsafeUnwrap().hits

    store.conflicts.resolve(conflict.id, 'merge', 'tolga')._unsafeUnwrap()
    const merged = store.memories.get(conflict.a.id)._unsafeUnwrap()
    expect(merged.text).toBe(conflict.b.text)
    expect(merged.hits).toBeGreaterThanOrEqual(before)
    expect(store.memories.get(conflict.b.id)._unsafeUnwrap().deletedAt).not.toBeNull()
  })

  test('dismissing keeps both and marks the detector wrong', () => {
    const { conflict } = openConflict()
    store.conflicts.resolve(conflict.id, 'dismiss', 'tolga')._unsafeUnwrap()
    expect(store.conflicts.get(conflict.id)?.status).toBe('dismissed')
    expect(store.memories.get(conflict.a.id)._unsafeUnwrap().deletedAt).toBeNull()
  })

  test('a resolved conflict cannot be resolved again', () => {
    const { conflict } = openConflict()
    store.conflicts.resolve(conflict.id, 'dismiss', 'tolga')._unsafeUnwrap()
    expect(store.conflicts.resolve(conflict.id, 'a', 'tolga')._unsafeUnwrapErr()).toMatchObject({
      kind: 'unknown-conflict',
    })
  })

  test('a settled pair is not proposed again on the next write', () => {
    const { conflict } = openConflict()
    store.conflicts.resolve(conflict.id, 'dismiss', 'tolga')._unsafeUnwrap()
    write(store, 'The weekly review runs Friday 16:00 sharp', {
      cluster: 'proc',
    })
    const pairs = store.conflicts.candidates().map((c) => [c.a.id, c.b.id].sort().join('|'))
    expect(pairs).not.toContain([conflict.a.id, conflict.b.id].sort().join('|'))
  })
})

describe('sources', () => {
  const DOC = [
    '# Runbook',
    '',
    'Freeze the index before exporting.',
    '',
    '## Rotation',
    '',
    'Rotate credentials on the first Tuesday after payday.',
  ].join('\n')

  test('ingesting chunks a document and the chunks are searchable', () => {
    const result = store.sources
      .ingest({
        filename: 'ops-handbook.md',
        cluster: 'proc',
        agent: 'atlas',
        text: DOC,
        trust: 0.8,
      })
      ._unsafeUnwrap()
    expect(result.chunks).toBeGreaterThan(1)
    expect(store.memories.search({ query: 'credentials' })._unsafeUnwrap().total).toBeGreaterThan(0)
  })

  test('chunks inherit their source trust rather than decaying', () => {
    const { source } = store.sources
      .ingest({
        filename: 'h.md',
        cluster: 'proc',
        agent: 'atlas',
        text: DOC,
        trust: 0.8,
      })
      ._unsafeUnwrap()
    const chunk = store.sources.chunks(source.id)[0]
    if (!chunk) throw new Error('expected a chunk')
    expect(chunk.strength).toBeCloseTo(0.8, 10)

    ctx.advance(2000)
    const later = store.memories.get(chunk.id)._unsafeUnwrap()
    expect(later.strength).toBeCloseTo(0.8, 10)
  })

  test('retrusting a source moves every one of its chunks at once', () => {
    const { source } = store.sources
      .ingest({
        filename: 'h.md',
        cluster: 'proc',
        agent: 'atlas',
        text: DOC,
        trust: 0.8,
      })
      ._unsafeUnwrap()
    store.sources.trust(source.id, 0.3, 'tolga')._unsafeUnwrap()
    for (const chunk of store.sources.chunks(source.id, 50)) {
      expect(chunk.strength).toBeCloseTo(0.3, 10)
    }
  })

  test('dropping a source removes its chunks but flags its claims for re-review', () => {
    const { source } = store.sources
      .ingest({
        filename: 'h.md',
        cluster: 'proc',
        agent: 'atlas',
        text: DOC,
        trust: 0.8,
      })
      ._unsafeUnwrap()
    const claim = store.memories
      .write({
        text: 'Rotate credentials the first Tuesday after payday',
        cluster: 'proc',
        agent: 'atlas',
        sourceId: source.id,
      })
      ._unsafeUnwrap()
    store.review.keep(claim.id, 'tolga')._unsafeUnwrap()

    const dropped = store.sources.drop(source.id, 'tolga')._unsafeUnwrap()
    expect(dropped.chunks).toBeGreaterThan(0)
    expect(dropped.flagged).toBe(1)

    const after = store.memories.get(claim.id)._unsafeUnwrap()
    expect(after.deletedAt).toBeNull()
    // Re-review is the whole flag: the evidence behind the claim is gone, so
    // the judgement that kept it has to be made again.
    expect(after.reviewedAt).toBeNull()
    expect(store.review.pending().map((p) => p.id)).toContain(claim.id)
    expect(store.sources.list()).toHaveLength(0)
  })

  test('a claim distilled from a source does enter the review queue', () => {
    const { source } = store.sources
      .ingest({ filename: 'h.md', cluster: 'proc', agent: 'atlas', text: DOC })
      ._unsafeUnwrap()
    const claim = store.memories
      .write({
        text: 'Freeze the index before exporting',
        cluster: 'proc',
        agent: 'atlas',
        sourceId: source.id,
      })
      ._unsafeUnwrap()
    expect(store.review.pending().map((p) => p.id)).toContain(claim.id)
    expect(claim.origin).toBe('doc')
  })

  test('rejects an empty document', () => {
    expect(
      store.sources
        .ingest({ filename: 'x.md', cluster: 'proc', agent: 'a', text: '  ' })
        ._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'invalid-input' })
  })
})

describe('bulk operations', () => {
  test('merging sums hits and unions readers', () => {
    const a = write(store, 'Prefers metric units')
    const b = write(store, 'Wants metric units everywhere')
    store.memories.countReads([b.id], 'atlas')

    const merged = store.memories.merge([a.id, b.id], 'tolga')._unsafeUnwrap()
    expect(merged.hits).toBe(1)
    expect([...merged.readers].sort()).toEqual(['atlas', 'wren'])
    expect(store.memories.get(b.id)._unsafeUnwrap().deletedAt).not.toBeNull()
  })

  test('merging fewer than two memories is an error, not a no-op', () => {
    const a = write(store, 'Prefers metric units')
    expect(store.memories.merge([a.id], 'tolga')._unsafeUnwrapErr()).toMatchObject({
      kind: 'invalid-input',
    })
  })

  test('export emits one JSON object per line', () => {
    const a = write(store, 'one')
    const b = write(store, 'two')
    const lines = store.memories.exportJsonl([a.id, b.id]).split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] ?? '{}').text).toBe('one')
  })

  test('a missing memory reports itself rather than returning undefined', () => {
    expect(store.memories.get('m_nope')._unsafeUnwrapErr()).toMatchObject({
      kind: 'unknown-memory',
    })
  })
})

describe('reporting', () => {
  test('counts claims, chunks and pending review separately', () => {
    write(store, 'Prefers metric units')
    store.sources.ingest({
      filename: 'a.md',
      cluster: 'proc',
      agent: 'atlas',
      text: 'One.\n\nTwo.',
    })
    const stats = store.stats()
    expect(stats.claims).toBe(1)
    expect(stats.chunks).toBeGreaterThan(0)
    expect(stats.pending).toBe(1)
    expect(stats.memories).toBe(stats.claims + stats.chunks)
  })

  test('the event log records writes newest first', () => {
    write(store, 'first')
    write(store, 'second')
    const log = store.events(10)
    expect(log[0]?.detail).toBe('second')
    expect(log[0]?.op).toBe('memory.write')
  })

  test('facet counts match what search returns', () => {
    write(store, 'a', { cluster: 'code', agent: 'forge' })
    write(store, 'b', { cluster: 'code', agent: 'forge' })
    write(store, 'c', { cluster: 'prefs' })
    const facets = store.memories.facets()
    expect(facets.cluster.find((c) => c.cluster_id === 'code')?.n).toBe(2)
    expect(store.memories.search({ query: 'cluster:code' })._unsafeUnwrap().total).toBe(2)
  })

  test('the timeline buckets creation over the store lifetime', () => {
    write(store, 'a')
    ctx.advance(30)
    write(store, 'b')
    const buckets = store.timeline(10)
    expect(buckets).toHaveLength(10)
    expect(buckets.reduce((sum, b) => sum + b.n, 0)).toBe(2)
  })
})
