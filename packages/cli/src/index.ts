import { parseArgs } from 'node:util'
import {
  type ConflictKind,
  type ConflictResolution,
  explain,
  type Memory,
  openStore,
  readSourceFile,
  type SearchMode,
  type Store,
} from '@ledger/core'
import { createServer, DEFAULT_PORT } from '@ledger/server'
import { defaultAgent, findUi, storePath } from './paths.ts'
import { printQueue, runReview } from './review-tui.ts'
import { accent, ago, bar, bold, danger, dim, heading, muted, truncate, write } from './term.ts'

/**
 * The `ledger` command.
 *
 * Two audiences share one binary, and the split between them is load-bearing:
 *
 * - **Agent commands** — `recall`, `remember`, `judge` and friends. `recall`
 *   counts as a retrieval, because an agent reaching for a memory is evidence
 *   that the memory is worth keeping.
 * - **Human commands** — `search`, `review`, `serve`, `stats`. None of them
 *   count. If supervising the store fed the strengths being supervised, the
 *   numbers would mean nothing.
 *
 * That is why `recall` and `search` are separate verbs rather than one command
 * with a flag. A flag would eventually be passed wrongly, and the failure would
 * be silent and unrecoverable.
 */

const HELP = `
${bold('ledger')} ${dim('— local memory for a fleet of agents')}

${dim('For agents')}
  ${accent('recall')} <query>            search; counts as a retrieval
  ${accent('remember')} <text>           write one memory      ${dim('--cluster required')}
  ${accent('forget')} <id...>            drop memories
  ${accent('link')} <a> <b>              record that two memories are related
  ${accent('clusters')}                  the topic taxonomy
  ${accent('conflicts')}                 pairs the store wants judged
  ${accent('judge')} <candidate>         ${dim('--verdict conflict|unrelated [--kind ...]')}
  ${accent('ingest')} <file>             store a document as searchable chunks

${dim('For you')}
  ${accent('serve')}                     the supervision UI     ${dim(`http://127.0.0.1:${DEFAULT_PORT}`)}
  ${accent('review')}                    work the queue in the terminal
  ${accent('search')} <query>            search without counting a retrieval
  ${accent('resolve')} <id> <how>        ${dim('a|b|both|merge|dismiss')}
  ${accent('sources')}                   ingested documents
  ${accent('stats')}                     what is in the store
  ${accent('export')} [query]            matching memories as JSONL

${dim('Filters')}  ${dim('agent: cluster: tag: type: kind: strength:<40 asof: after: before:')}

${dim('Options')}
  --agent <id>       who is acting        ${dim('($LEDGER_AGENT, default "agent")')}
  --cluster <id>     cluster to write to
  --tags a,b         tags for remember
  --json             machine-readable output
  --limit <n>        results              ${dim('(default 10 recall, 25 search)')}
  --db <path>        store location       ${dim('($LEDGER_DB)')}
  --port <n>         serve port           ${dim(`(default ${DEFAULT_PORT})`)}

${dim('Store')}  ${dim(storePath())}
`

type Options = {
  db: string
  agent: string
  cluster: string | undefined
  tags: string[]
  port: number
  host: string
  json: boolean
  trust: number | undefined
  limit: number | undefined
  mode: SearchMode | undefined
  verdict: string | undefined
  kind: string | undefined
  detector: number | undefined
  note: string | undefined
  text: string | undefined
}

const withStore = <T>(options: Options, run: (store: Store) => T): T => {
  const store = openStore({ path: options.db })
  try {
    return run(store)
  } finally {
    store.close()
  }
}

const fail = (message: string): never => {
  process.stderr.write(`${danger('✕')} ${message}\n`)
  process.exit(1)
}

/**
 * One memory, rendered for an agent reading Bash output.
 *
 * Full id — it is needed verbatim for `link` and `forget` — then strength on
 * the 0-100 scale, then the text.
 *
 * Exactly one line per result, so the output stays scannable and parseable.
 * Document chunks are multi-line in the store, so their whitespace is collapsed
 * rather than truncated: the text of a chunk is the thing the agent asked for,
 * and cutting it short would defeat the retrieval.
 */
const agentLine = (m: Memory): string =>
  `${m.id}  ${String(Math.round(m.strength * 100)).padStart(3)}  ${m.text
    .replace(/\s+/g, ' ')
    .trim()}${dim(`  [${[m.clusterId, ...m.tags].join(', ')}]`)}`

export const run = async (argv: readonly string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      db: { type: 'string' },
      agent: { type: 'string' },
      cluster: { type: 'string' },
      tags: { type: 'string' },
      port: { type: 'string' },
      host: { type: 'string' },
      trust: { type: 'string' },
      limit: { type: 'string' },
      mode: { type: 'string' },
      verdict: { type: 'string' },
      kind: { type: 'string' },
      detector: { type: 'string' },
      note: { type: 'string' },
      text: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  const options: Options = {
    db: values.db ?? storePath(),
    agent: values.agent ?? defaultAgent(),
    cluster: values.cluster,
    tags: values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    port: values.port ? Number(values.port) : DEFAULT_PORT,
    host: values.host ?? '127.0.0.1',
    json: values.json ?? false,
    trust: values.trust ? Number(values.trust) : undefined,
    limit: values.limit ? Number(values.limit) : undefined,
    mode: values.mode as SearchMode | undefined,
    verdict: values.verdict,
    kind: values.kind,
    detector: values.detector ? Number(values.detector) : undefined,
    note: values.note,
    text: values.text,
  }

  const [command, ...rest] = positionals
  if (values.help || !command) {
    write(HELP)
    return
  }

  switch (command) {
    // ───────────────────────────────────────────────────────────── for agents

    case 'recall': {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(' '),
          agent: options.agent,
          countRead: true,
          limit: options.limit ?? 10,
          ...(options.mode ? { mode: options.mode } : {}),
        })
        if (found.isErr()) fail(explain(found.error))
        const result = found._unsafeUnwrap()

        if (options.json) {
          write(JSON.stringify(result.hits, null, 2))
          return
        }
        if (result.total === 0) {
          write('nothing remembered about that')
          return
        }
        write(
          `${result.total} ${result.total === 1 ? 'memory' : 'memories'}${
            result.capped ? ' (more matched than could be ranked — narrow the query)' : ''
          }`,
        )
        for (const m of result.hits) write(agentLine(m))
      })
      return
    }

    case 'remember': {
      const text = options.text ?? rest.join(' ')
      if (!text) {
        fail('Nothing to remember. Try: ledger remember "Prefers metric units" --cluster prefs')
      }
      if (!options.cluster)
        fail('--cluster is required. Run `ledger clusters` to see the taxonomy.')
      withStore(options, (store) => {
        const written = store.memories.write({
          text,
          cluster: options.cluster ?? '',
          agent: options.agent,
          tags: options.tags,
          ...(options.note ? { provenance: options.note } : {}),
        })
        if (written.isErr()) fail(explain(written.error))
        const m = written._unsafeUnwrap()

        if (options.json) {
          write(JSON.stringify(m, null, 2))
          return
        }
        write(`remembered ${m.id}`)
        const waiting = store.stats().candidates
        if (waiting > 0) {
          write(
            `${waiting} conflict candidate${waiting === 1 ? '' : 's'} waiting — run \`ledger conflicts\` when convenient`,
          )
        }
      })
      return
    }

    case 'forget': {
      if (rest.length === 0) fail('Which memories? Try: ledger forget m_abc123')
      withStore(options, (store) => {
        const dropped = store.memories.remove(rest, options.agent)
        write(`forgot ${dropped} — still answerable by asof: queries`)
      })
      return
    }

    case 'link': {
      const [a, b] = rest
      if (!a || !b) fail('Two memory ids required. Try: ledger link m_abc m_def')
      withStore(options, (store) => {
        const linked = store.memories.link(a ?? '', b ?? '', options.agent)
        if (linked.isErr()) fail(explain(linked.error))
        write(`linked ${a} ${b}`)
      })
      return
    }

    case 'clusters': {
      withStore(options, (store) => {
        if (rest[0] === 'add') {
          const label = rest.slice(1).join(' ')
          if (!label) fail('What should it be called? Try: ledger clusters add "Client work"')
          const created = store.clusters.create({ label })
          if (created.isErr()) fail(explain(created.error))
          write(`${accent('✓')} ${created._unsafeUnwrap().id}`)
          return
        }
        if (options.json) {
          write(JSON.stringify(store.clusters.list(), null, 2))
          return
        }
        const counts = new Map(store.memories.facets().cluster.map((c) => [c.cluster_id, c.n]))
        for (const c of store.clusters.list()) {
          write(
            `${c.id.padEnd(14)} ${dim(c.label.padEnd(20))} ${dim(String(counts.get(c.id) ?? 0))}`,
          )
        }
      })
      return
    }

    case 'conflicts': {
      withStore(options, (store) => {
        const candidates = store.conflicts.candidates(options.limit ?? 5)
        if (options.json) {
          write(JSON.stringify(candidates, null, 2))
          return
        }
        if (candidates.length === 0) {
          write('nothing to judge')
          return
        }
        for (const c of candidates) {
          write('')
          write(`${c.id}  ${dim(c.signals.join(', '))}`)
          write(`  A  ${c.a.id}  ${c.a.text}`)
          write(`  B  ${c.b.id}  ${c.b.text}`)
        }
        write('')
        write('For each pair: can both be true at once?')
        write('  no  → ledger judge <id> --verdict conflict --kind "<kind>" --detector 0.0-1.0')
        write('  yes → ledger judge <id> --verdict unrelated    (settles the pair for good)')
      })
      return
    }

    case 'judge': {
      const candidateId = rest[0]
      if (!candidateId) fail('Which candidate? Run `ledger conflicts` to list them.')
      if (options.verdict !== 'conflict' && options.verdict !== 'unrelated') {
        fail('--verdict must be "conflict" or "unrelated"')
      }
      withStore(options, (store) => {
        const judged = store.conflicts.judge({
          candidateId: candidateId ?? '',
          agent: options.agent,
          verdict: options.verdict === 'conflict' ? 'conflict' : 'unrelated',
          ...(options.kind ? { kind: options.kind as ConflictKind } : {}),
          ...(options.detector !== undefined ? { detector: options.detector } : {}),
          ...(options.note ? { note: options.note } : {}),
        })
        if (judged.isErr()) fail(explain(judged.error))
        const conflict = judged._unsafeUnwrap()
        write(
          conflict === null
            ? 'settled — marked unrelated, will not be proposed again'
            : `queued ${conflict.id} — ${conflict.kind}, for the human to resolve`,
        )
      })
      return
    }

    case 'ingest': {
      const path = rest[0]
      if (!options.cluster) fail('--cluster is required.')

      // Either a file the CLI can read itself, or text piped in for the formats
      // it cannot — PDF and friends are the caller's job.
      let filename = path ?? 'stdin'
      let text = options.text
      let bytes: number | undefined
      if (text === undefined) {
        if (!path) fail('Which file? Try: ledger ingest notes.md --cluster reading')
        if (path === '-') {
          text = await Bun.stdin.text()
          filename = 'stdin'
        } else {
          const read = await readSourceFile(path ?? '')
          if (read.isErr()) fail(explain(read.error))
          const source = read._unsafeUnwrap()
          filename = source.filename
          text = source.text
          bytes = source.bytes
        }
      }

      withStore(options, (store) => {
        const ingested = store.sources.ingest({
          filename,
          cluster: options.cluster ?? '',
          agent: options.agent,
          text: text ?? '',
          ...(bytes !== undefined ? { bytes } : {}),
          ...(options.trust !== undefined ? { trust: options.trust } : {}),
        })
        if (ingested.isErr()) fail(explain(ingested.error))
        const { source, chunks } = ingested._unsafeUnwrap()
        if (options.json) {
          write(JSON.stringify({ sourceId: source.id, chunks }, null, 2))
          return
        }
        write(`ingested ${source.id}  ${chunks} chunks`)
        write('Chunks are searchable now and are never reviewed one by one. If the document')
        write('asserts something worth remembering on its own, `ledger remember` it as a claim')
        write('— that becomes a reviewable memory.')
      })
      return
    }

    // ────────────────────────────────────────────────────────────── for humans

    case 'serve': {
      const ui = await findUi()
      const server = createServer({
        store: { path: options.db },
        port: options.port,
        host: options.host,
        ...(ui ? { ui } : {}),
      })
      const running = server.listen()
      const stats = server.store.stats()

      write()
      write(`  ${accent('●')} ${bold('LEDGER')} ${dim('running')}   ${muted(running.url)}`)
      write(
        `  ${dim(`${stats.memories} memories · ${stats.pending} pending review · ${options.db}`)}`,
      )
      if (!ui) write(`  ${dim('ui   not bundled — run `bun run build:skill` in the workspace')}`)
      write()
      write(`  ${dim('Bound to loopback. Nothing in this store leaves this machine.')}`)
      write()

      const stop = (): void => {
        void running.stop().then(() => process.exit(0))
      }
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
      await new Promise(() => {})
      return
    }

    case 'review': {
      const store = openStore({ path: options.db })
      try {
        if (options.json || !process.stdin.isTTY) printQueue(store)
        else await runReview(store)
      } finally {
        store.close()
      }
      return
    }

    case 'search': {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(' '),
          limit: options.limit ?? 25,
          countRead: false,
          ...(options.mode ? { mode: options.mode } : {}),
        })
        if (found.isErr()) fail(explain(found.error))
        const result = found._unsafeUnwrap()
        if (options.json) {
          write(JSON.stringify(result.hits, null, 2))
          return
        }
        heading(
          `${result.total} ${result.total === 1 ? 'memory' : 'memories'}`,
          `${Math.round(result.tookMs)}ms${result.capped ? ' · more matched than could be ranked' : ''}`,
        )
        const now = store.now()
        for (const m of result.hits) {
          write(
            `  ${dim(m.id.slice(-6))}  ${bar(m.strength, 6)} ${dim(
              String(Math.round(m.strength * 100)).padStart(3),
            )}  ${dim(m.writer.padEnd(7))} ${truncate(m.text, 70).padEnd(70)} ${dim(
              m.clusterLabel.padEnd(16),
            )} ${dim(ago(m.lastReadAt, now))}`,
          )
        }
        write()
      })
      return
    }

    case 'resolve': {
      const [conflictId, resolution] = rest
      if (!conflictId || !resolution) {
        fail('Try: ledger resolve <conflictId> a|b|both|merge|dismiss')
      }
      withStore(options, (store) => {
        const resolved = store.conflicts.resolve(
          conflictId ?? '',
          resolution as ConflictResolution,
          'human',
        )
        if (resolved.isErr()) fail(explain(resolved.error))
        write(`${accent('resolved')} ${conflictId} — ${resolution}`)
      })
      return
    }

    case 'sources': {
      withStore(options, (store) => {
        const list = store.sources.list()
        if (options.json) {
          write(JSON.stringify(list, null, 2))
          return
        }
        heading('Sources', `${list.length} documents`)
        for (const s of list) {
          write(
            `  ${dim(s.ext.toUpperCase().padEnd(5))} ${bold(truncate(s.filename, 40).padEnd(40))} ${bar(
              s.trust,
              6,
            )} ${dim(`${s.chunkCount} chunks · ${s.claimCount} claims · ${s.hits} reads`)}`,
          )
        }
        write()
      })
      return
    }

    case 'stats': {
      withStore(options, (store) => {
        const s = store.stats()
        if (options.json) {
          write(JSON.stringify(s, null, 2))
          return
        }
        heading('LEDGER', options.db)
        write(
          `  ${bold(String(s.memories).padStart(6))}  memories   ${dim(`${s.claims} claims · ${s.chunks} chunks`)}`,
        )
        write(`  ${bold(String(s.pending).padStart(6))}  pending review`)
        write(
          `  ${bold(String(s.conflicts).padStart(6))}  open conflicts   ${dim(`${s.candidates} candidates awaiting an agent`)}`,
        )
        write(`  ${bold(String(s.sources).padStart(6))}  sources`)
        write(
          `  ${bold(String(s.agents).padStart(6))}  agents     ${dim(`${s.requestsToday} calls today`)}`,
        )
        write(`  ${dim(`${(s.diskBytes / 1e6).toFixed(1)} MB on disk`)}`)
        write()
      })
      return
    }

    case 'export': {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(' '),
          limit: 100_000,
          countRead: false,
        })
        if (found.isErr()) fail(explain(found.error))
        for (const m of found._unsafeUnwrap().hits) write(JSON.stringify(m))
      })
      return
    }

    default:
      fail(`Unknown command "${command}". Run \`ledger --help\`.`)
  }
}
