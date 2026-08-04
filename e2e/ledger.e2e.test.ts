import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from '@ledger/server'

/**
 * End-to-end, the way the two audiences actually reach the store:
 *
 * - an **agent** shells out to the bundled CLI, exactly as SKILL.md instructs
 * - a **human** uses the supervision API the UI talks to
 *
 * The CLI runs as a subprocess against the real bundle rather than being
 * imported — if the bundle is stale, missing, or crashes on startup, this
 * fails, which is the whole reason to run it this way.
 *
 * `bun run test:e2e`, deliberately separate from the unit and integration
 * suites, which need no ports, files or subprocesses.
 */

const DB = `/tmp/ledger-e2e-${Date.now()}.db`
const PORT = 7499
const BASE = `http://127.0.0.1:${PORT}`
const SKILL = join(import.meta.dir, '..', 'skills', 'ledger-memory')
const CLI = join(SKILL, 'cli.js')

let running: { url: string; stop: () => Promise<void> }

/** Run the bundled CLI the way an agent would. */
const ledger = async (
  args: readonly string[],
): Promise<{ out: string; err: string; code: number }> => {
  const proc = Bun.spawn(['bun', CLI, ...args, '--db', DB], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LEDGER_AGENT: 'forge', NO_COLOR: '1' },
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { out, err, code }
}

const ledgerJson = async <T>(args: readonly string[]): Promise<T> => {
  const { out, err, code } = await ledger([...args, '--json'])
  if (code !== 0) throw new Error(`ledger ${args.join(' ')} exited ${code}: ${err}`)
  return JSON.parse(out) as T
}

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  return (await response.json()) as T
}

beforeAll(async () => {
  if (!(await Bun.file(CLI).exists())) {
    throw new Error(`No bundled CLI at ${CLI}. Run \`bun run build:skill\` first.`)
  }
  running = createServer({ store: { path: DB }, port: PORT, host: '127.0.0.1' }).listen()
})

afterAll(async () => {
  await running.stop()
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      unlinkSync(`${DB}${suffix}`)
    } catch {
      // WAL files may not exist; nothing to clean up.
    }
  }
})

describe('the bundle is installable and runs', () => {
  test('the CLI starts and describes itself', async () => {
    const { out, code } = await ledger(['--help'])
    expect(code).toBe(0)
    for (const command of ['recall', 'remember', 'conflicts', 'judge', 'ingest', 'serve']) {
      expect(out).toContain(command)
    }
  })

  test('the skill ships everything SKILL.md promises', async () => {
    for (const file of ['SKILL.md', 'cli.js', 'ui/index.html']) {
      expect(await Bun.file(join(SKILL, file)).exists()).toBe(true)
    }
  })

  test('SKILL.md carries the frontmatter the skills CLI requires', async () => {
    const text = await Bun.file(join(SKILL, 'SKILL.md')).text()
    expect(text).toStartWith('---\n')
    expect(text).toContain('name: ledger-memory')
    expect(text).toMatch(/\ndescription: \S/)
  })

  test('the supervision server is up and local', async () => {
    const health = (await (await fetch(`${BASE}/health`)).json()) as { ok: boolean }
    expect(health.ok).toBe(true)
  })
})

describe('an agent lives its whole life through the CLI', () => {
  test('learns the taxonomy, then remembers something', async () => {
    const clusters = await ledgerJson<{ id: string }[]>(['clusters'])
    expect(clusters.map((c) => c.id)).toContain('code')

    const { out, code } = await ledger([
      'remember',
      'opal requires Node 22 — 20 breaks the wasm loader',
      '--cluster',
      'code',
      '--note',
      'confirmed by follow-up question',
    ])
    expect(code).toBe(0)
    expect(out).toContain('remembered m_')
  })

  test('refuses an unknown cluster and names the ones that exist', async () => {
    const { err, code } = await ledger(['remember', 'x', '--cluster', 'not-a-cluster'])
    expect(code).toBe(1)
    expect(err).toContain('code')
  })

  test('refuses to remember nothing', async () => {
    const { code } = await ledger(['remember', '--cluster', 'code'])
    expect(code).toBe(1)
  })

  test('recall finds it, and prints ids the agent can act on', async () => {
    const { out } = await ledger(['recall', 'node wasm loader'])
    expect(out).toContain('opal requires Node 22')
    expect(out).toMatch(/m_\w+\s+\d+\s+opal requires/)
    expect(out).toContain('[code]')
  })

  test('recall counts as a retrieval and strengthens the memory', async () => {
    const [before] = await ledgerJson<{ id: string; strength: number }[]>(['recall', 'wasm'])
    expect(before).toBeDefined()

    for (let i = 0; i < 5; i += 1) await ledger(['recall', 'wasm'])

    const [after] = await ledgerJson<{ strength: number; hits: number }[]>(['recall', 'wasm'])
    expect(after?.strength).toBeGreaterThan(before?.strength ?? 1)
    expect(after?.hits).toBeGreaterThan(0)
  })

  test('search does not — a human looking is not evidence', async () => {
    const [before] = await ledgerJson<{ id: string; hits: number }[]>(['search', 'wasm'])
    await ledger(['search', 'wasm'])
    await ledger(['search', 'wasm'])
    const [after] = await ledgerJson<{ hits: number }[]>(['search', 'wasm'])
    expect(after?.hits).toBe(before?.hits ?? -1)
  })

  test('every result is exactly one line, even multi-line document chunks', async () => {
    const path = join(import.meta.dir, '..', 'packages', 'core', 'fixtures', 'ops-handbook.md')
    await ledger(['ingest', path, '--cluster', 'health', '--trust', '0.9'])

    const { out } = await ledger(['recall', 'credentials rotation payday'])
    const lines = out.trim().split('\n')
    // First line is the count; every line after it is one whole memory.
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines.slice(1)) expect(line).toMatch(/^[mc]_\w+\s+\d+\s+\S/)
  })

  test('recall says so plainly when it knows nothing', async () => {
    const { out } = await ledger(['recall', 'zzzznothinghere'])
    expect(out).toContain('nothing remembered')
  })

  test('a bad filter is reported, not silently ignored', async () => {
    const { err, code } = await ledger(['recall', 'asof:whenever'])
    expect(code).toBe(1)
    expect(err).toContain('date')
  })
})

describe('a contradiction goes from write to resolution', () => {
  let candidateId = ''
  let beforeResolution = ''

  test('a second write makes the store propose a candidate', async () => {
    await ledger(['remember', 'The weekly review runs Friday 16:00', '--cluster', 'proc'])
    const second = await ledger([
      'remember',
      'The weekly review runs Thursday 09:30',
      '--cluster',
      'proc',
    ])
    expect(second.out).toContain('conflict candidate')

    const { out } = await ledger(['conflicts'])
    expect(out).toContain('divergent times')
    expect(out).toContain('The weekly review runs Friday 16:00')
    candidateId = out.match(/cc_\w+/)?.[0] ?? ''
    expect(candidateId).not.toBe('')

    // The store proposes. It must not have decided anything on its own.
    const review = await api<{ conflicts: unknown[] }>('/review')
    expect(review.conflicts).toHaveLength(0)
  })

  test('the agent judging it a conflict puts it in the human queue', async () => {
    const { out, code } = await ledger([
      'judge',
      candidateId,
      '--verdict',
      'conflict',
      '--kind',
      'stale schedule',
      '--detector',
      '0.88',
    ])
    expect(code).toBe(0)
    expect(out).toContain('stale schedule')

    const review = await api<{ conflicts: { kind: string; detector: number }[] }>('/review')
    expect(review.conflicts).toHaveLength(1)
    expect(review.conflicts[0]?.detector).toBeCloseTo(0.88, 5)
  })

  test("resolving is the human's, and the skill says so", async () => {
    const skill = await Bun.file(join(SKILL, 'SKILL.md')).text()
    expect(skill).toContain('There is no command to resolve a conflict, deliberately')
  })

  test('the human resolves it and the losing memory retires', async () => {
    const review = await api<{ conflicts: { id: string; a: { id: string } }[] }>('/review')
    const conflict = review.conflicts[0]
    expect(conflict).toBeDefined()
    beforeResolution = new Date().toISOString()

    const { code } = await ledger(['resolve', conflict?.id ?? '', 'b'])
    expect(code).toBe(0)

    const after = await api<{ conflicts: unknown[] }>('/review')
    expect(after.conflicts).toHaveLength(0)

    const remaining = await ledgerJson<{ id: string }[]>(['search', 'weekly review'])
    expect(remaining.map((m) => m.id)).not.toContain(conflict?.a.id)
  })

  test('but it still answers what we believed at the time', async () => {
    const then = await ledgerJson<{ text: string }[]>([
      'search',
      `weekly review asof:${beforeResolution}`,
    ])
    expect(then.map((m) => m.text)).toContain('The weekly review runs Friday 16:00')
  })

  test('an unrelated verdict settles a pair for good', async () => {
    await ledger(['remember', 'Renews the domain portfolio every January', '--cluster', 'money'])
    await ledger(['remember', 'Renews the domain portfolio every March', '--cluster', 'money'])

    const listed = await ledger(['conflicts'])
    const id = listed.out.match(/cc_\w+/)?.[0] ?? ''
    expect(id).not.toBe('')

    const { out } = await ledger(['judge', id, '--verdict', 'unrelated'])
    expect(out).toContain('settled')

    const again = await ledger(['conflicts'])
    expect(again.out).not.toContain(id)
  })
})

describe('documents become chunks, and claims are distilled from them', () => {
  let sourceId = ''

  test('ingesting a file the CLI can read', async () => {
    const path = join(import.meta.dir, '..', 'packages', 'core', 'fixtures', 'ops-handbook.md')
    const { out, code } = await ledger(['ingest', path, '--cluster', 'proc', '--trust', '0.86'])
    expect(code).toBe(0)
    expect(out).toContain('chunks')
    sourceId = out.match(/s_\w+/)?.[0] ?? ''
    expect(sourceId).not.toBe('')
  })

  test('ingesting text piped in, for formats it cannot parse', async () => {
    const proc = Bun.spawn(
      ['bun', CLI, 'ingest', '-', '--cluster', 'reading', '--trust', '0.7', '--db', DB],
      {
        stdin: new TextEncoder().encode('# Peng 2023\n\nAttention approximates compression.'),
        stdout: 'pipe',
        env: { ...process.env, NO_COLOR: '1' },
      },
    )
    const out = await new Response(proc.stdout).text()
    expect(await proc.exited).toBe(0)
    expect(out).toContain('chunks')

    const found = await ledgerJson<unknown[]>(['recall', 'attention compression'])
    expect(found.length).toBeGreaterThan(0)
  })

  test('chunks inherit source trust and never enter the review queue', async () => {
    const sources = await api<{ id: string; chunkPreview: { strength: number }[] }[]>('/sources')
    const source = sources.find((s) => s.id === sourceId)
    expect(source?.chunkPreview[0]?.strength).toBeCloseTo(0.86, 5)

    const review = await api<{ claims: { kind: string }[] }>('/review')
    expect(review.claims.every((c) => c.kind === 'claim')).toBe(true)
  })

  test('dropping a source removes its chunks but keeps its claims', async () => {
    await ledger([
      'remember',
      'Rotate credentials on the first Tuesday after payday',
      '--cluster',
      'proc',
    ])
    const dropped = await api<{ chunks: number }>(`/sources/${sourceId}`, { method: 'DELETE' })
    expect(dropped.chunks).toBeGreaterThan(0)

    const chunks = await ledgerJson<unknown[]>(['search', 'kind:chunk cluster:proc'])
    expect(chunks).toHaveLength(0)

    const claims = await ledgerJson<{ text: string }[]>(['search', 'credentials'])
    expect(claims.map((c) => c.text)).toContain(
      'Rotate credentials on the first Tuesday after payday',
    )
  })
})

describe('the human supervises', () => {
  test('the review queue clears', async () => {
    const before = await api<{ claims: { id: string }[] }>('/review')
    expect(before.claims.length).toBeGreaterThan(0)
    for (const claim of before.claims) {
      await api(`/review/${claim.id}/keep`, { method: 'POST' })
    }
    expect((await api<{ claims: unknown[] }>('/review')).claims).toHaveLength(0)
  })

  test('stats add up and writes are attributed to the agent', async () => {
    const stats = await ledgerJson<{
      memories: number
      claims: number
      chunks: number
    }>(['stats'])
    expect(stats.memories).toBe(stats.claims + stats.chunks)

    const { agents } = await api<{ agents: { id: string; wrote: number }[] }>('/agents')
    expect(agents.map((a) => a.id)).toContain('forge')
    expect(agents.find((a) => a.id === 'forge')?.wrote).toBeGreaterThan(0)
  })

  test('export emits one JSON object per line', async () => {
    const { out } = await ledger(['export', 'cluster:code'])
    const lines = out.trim().split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    expect(JSON.parse(lines[0] ?? '{}').clusterId).toBe('code')
  })

  test('the canvas gets everything it needs in one call', async () => {
    const graph = await api<{ nodes: unknown[]; clusters: unknown[] }>('/graph')
    expect(graph.nodes.length).toBeGreaterThan(0)
    expect(graph.clusters).toHaveLength(10)
  })
})
