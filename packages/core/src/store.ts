import { Database } from 'bun:sqlite'
import { clusterPalette } from '@ledger/tokens'
import { err, ok, type Result } from 'neverthrow'
import { pairKey, suspect } from './conflicts.ts'
import type { LedgerFailure } from './errors.ts'
import { newId, slug } from './ids.ts'
import { chunkText, DEFAULT_CHUNKING, extensionOf } from './ingest.ts'
import { type ParsedQuery, parseQuery } from './query.ts'
import { hydrate, type MemoryRow, SELECT_MEMORY } from './rows.ts'
import { DDL, SCHEMA_VERSION, SEED_CLUSTERS } from './schema.ts'
import { FUZZY_FLOOR, ftsQuery, fuzzyScore, normaliseBm25, rank } from './search.ts'
import type {
  Agent,
  Cluster,
  Conflict,
  ConflictCandidate,
  ConflictKind,
  ConflictResolution,
  LogEntry,
  Memory,
  MemoryOrigin,
  SearchHit,
  SearchMode,
  Source,
  Stats,
} from './types.ts'

/**
 * Ceiling on rows pulled into memory for ranking in a single search.
 *
 * Strength cannot be filtered or sorted in SQL — it is a function of the
 * current time — so ranking happens in TypeScript over a bounded window. When
 * the window fills, results say so (`capped`) rather than quietly pretending
 * to be the whole answer.
 */
export const SCAN_LIMIT = 5_000

/** Claims compared against a new write when looking for conflict candidates. */
export const CANDIDATE_COMPARISONS = 500

export type StoreOptions = {
  /** Path to the SQLite file, or `:memory:` for tests. */
  readonly path: string
  /** Injectable clock. Every timestamp in the store comes from here. */
  readonly clock?: () => number
  /** Seed the starting cluster taxonomy on first open. Default true. */
  readonly seed?: boolean
}

export type WriteInput = {
  readonly text: string
  readonly cluster: string
  readonly agent: string
  readonly origin?: MemoryOrigin
  readonly provenance?: string
  readonly sourceId?: string | null
  /** Explicitly declare that this replaces an existing claim. */
  readonly supersedes?: string | null
  readonly createdAt?: number
}

export type SearchInput = {
  readonly query: string
  readonly agent?: string
  readonly mode?: SearchMode
  readonly limit?: number
  readonly offset?: number
  readonly kind?: 'claim' | 'chunk' | 'all'
  readonly includeArchived?: boolean
  readonly pendingOnly?: boolean
  readonly conflictedOnly?: boolean
  readonly pinnedOnly?: boolean
  readonly sort?: 'relevance' | 'strength' | 'hits' | 'created' | 'last'
  readonly dir?: 'asc' | 'desc'
  /**
   * Whether this read counts as retrieval.
   *
   * An agent retrieving a memory is evidence the memory is useful, and feeds
   * `used`/`fresh`. A human scrolling the Browse table is not — if it were, the
   * act of supervising the store would inflate the numbers being supervised.
   * MCP passes true; the UI passes false.
   */
  readonly countRead?: boolean
}

export type SearchResult = {
  readonly hits: readonly SearchHit[]
  readonly total: number
  readonly tookMs: number
  /** True when more rows matched than the scan window could rank. */
  readonly capped: boolean
}

export type IngestInput = {
  readonly filename: string
  readonly cluster: string
  readonly agent: string
  /** Pre-extracted text. Required for formats the server cannot read itself. */
  readonly text: string
  readonly trust?: number
  readonly bytes?: number
}

export type SourceSummary = Source & {
  readonly chunkCount: number
  readonly claimCount: number
  readonly hits: number
}

export type JudgeInput = {
  readonly candidateId: string
  readonly agent: string
  readonly verdict: 'conflict' | 'unrelated'
  readonly kind?: ConflictKind
  readonly detector?: number
  readonly note?: string
}

export type Store = ReturnType<typeof openStore>

const asRow = <T>(value: unknown): T | null => (value ?? null) as T | null

export const openStore = (options: StoreOptions) => {
  const db = new Database(options.path, { create: true, strict: true })
  const now = options.clock ?? (() => Date.now())
  const openedAt = now()

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.run(DDL)
  db.query('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    'schema_version',
    String(SCHEMA_VERSION),
  )

  if (options.seed !== false) {
    const insertCluster = db.query(
      'INSERT OR IGNORE INTO clusters (id, label, color, created_at) VALUES (?, ?, ?, ?)',
    )
    const seedAll = db.transaction(() => {
      for (const c of SEED_CLUSTERS) insertCluster.run(c.id, c.label, c.color, openedAt)
    })
    seedAll()
  }

  // ---------------------------------------------------------------- internals

  const record = (
    agent: string,
    op: string,
    memoryId: string | null,
    detail: string,
    ms?: number,
  ): void => {
    db.query(
      'INSERT INTO events (at, agent, op, memory_id, detail, ms) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(now(), agent, op, memoryId, detail, ms ?? null)
  }

  const clusterExists = (id: string): boolean =>
    db.query('SELECT 1 FROM clusters WHERE id = ?').get(id) !== null

  const clusterIds = (): string[] =>
    db
      .query('SELECT id FROM clusters ORDER BY id')
      .all()
      .map((r) => (r as { id: string }).id)

  const requireCluster = (id: string): Result<string, LedgerFailure> =>
    clusterExists(id) ? ok(id) : err({ kind: 'unknown-cluster', cluster: id, known: clusterIds() })

  const rowById = (id: string): MemoryRow | null =>
    asRow<MemoryRow>(db.query(`${SELECT_MEMORY} WHERE m.id = ?`).get(id))

  const requireMemory = (id: string): Result<MemoryRow, LedgerFailure> => {
    const row = rowById(id)
    return row ? ok(row) : err({ kind: 'unknown-memory', id })
  }

  /** Self-declared identity: seeing an agent id is what registers it. */
  const touchAgent = (id: string): void => {
    const at = now()
    const existing = db.query('SELECT id FROM agents WHERE id = ?').get(id)
    if (existing) {
      db.query('UPDATE agents SET last_seen = ? WHERE id = ?').run(at, id)
      return
    }
    const count = db.query('SELECT count(*) AS n FROM agents').get() as {
      n: number
    }
    const color = clusterPalette[count.n % clusterPalette.length] ?? '#868d95'
    db.query(
      `INSERT INTO agents (id, label, role, color, endpoint, first_seen, last_seen)
       VALUES (?, ?, '', ?, '', ?, ?)`,
    ).run(id, id, color, at, at)
  }

  const addReader = (memoryId: string, agentId: string): void => {
    db.query('INSERT OR IGNORE INTO memory_readers (memory_id, agent_id) VALUES (?, ?)').run(
      memoryId,
      agentId,
    )
  }

  const indexText = (id: string, text: string): void => {
    db.query('DELETE FROM memories_fts WHERE id = ?').run(id)
    db.query('INSERT INTO memories_fts (id, text) VALUES (?, ?)').run(id, text)
  }

  /**
   * Propose conflict candidates for a freshly written claim.
   *
   * Bounded to the most recently touched claims in the same cluster: an
   * unbounded pairwise sweep on every write is how a memory store becomes
   * unusable at ten thousand memories.
   */
  const proposeCandidates = (memory: MemoryRow): void => {
    if (memory.kind !== 'claim') return
    const peers = db
      .query(
        `SELECT id, text FROM memories
          WHERE cluster_id = ? AND kind = 'claim' AND deleted_at IS NULL
            AND archived = 0 AND id != ?
          ORDER BY last_read_at DESC LIMIT ?`,
      )
      .all(memory.cluster_id, memory.id, CANDIDATE_COMPARISONS) as {
      id: string
      text: string
    }[]

    const insert = db.query(
      `INSERT OR IGNORE INTO conflict_candidates (id, a, b, score, signals, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    const at = now()
    for (const peer of peers) {
      const s = suspect(memory.text, peer.text)
      if (!s) continue
      const [a, b] = pairKey(memory.id, peer.id)
      const settled = db
        .query(`SELECT 1 FROM conflicts WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)`)
        .get(a, b, b, a)
      if (settled) continue
      insert.run(newId('cc'), a, b, s.score, s.signals.join(', '), at)
    }
  }

  const openConflict = (
    a: string,
    b: string,
    clusterId: string,
    kind: ConflictKind,
    detector: number,
    note: string,
  ): Conflict | null => {
    const id = newId('cf')
    db.query(
      `INSERT INTO conflicts (id, kind, cluster_id, a, b, detector, note, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    ).run(id, kind, clusterId, a, b, detector, note, now())
    return conflicts.get(id)
  }

  /**
   * Retire a memory without destroying it.
   *
   * The FTS row deliberately stays. Removing it would make `asof:` a lie: a
   * text search for what the fleet believed last January could never reach a
   * memory dropped since, which is precisely the memory that question is about.
   * Every live query already filters on `deleted_at`, so a retained index entry
   * costs a little space and changes nothing else.
   */
  const softDelete = (id: string, agent: string, reason: string): void => {
    db.query('UPDATE memories SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(
      now(),
      id,
    )
    db.query(
      `UPDATE conflicts SET status = 'resolved', resolved_at = ?
        WHERE status = 'open' AND (a = ? OR b = ?)`,
    ).run(now(), id, id)
    record(agent, 'memory.drop', id, reason)
  }

  // ----------------------------------------------------------------- clusters

  const clusters = {
    list: (): Cluster[] =>
      db
        .query('SELECT id, label, color, created_at FROM clusters ORDER BY label')
        .all()
        .map((r) => {
          const row = r as {
            id: string
            label: string
            color: string
            created_at: number
          }
          return {
            id: row.id,
            label: row.label,
            color: row.color,
            createdAt: row.created_at,
          }
        }),

    create: (input: {
      id?: string
      label: string
      color?: string
    }): Result<Cluster, LedgerFailure> => {
      const label = input.label.trim()
      if (!label)
        return err({
          kind: 'invalid-input',
          issues: ['cluster label is empty'],
        })
      const id = slug(input.id ?? label)
      if (!id)
        return err({
          kind: 'invalid-input',
          issues: ['cluster id is empty after slugify'],
        })
      const count = db.query('SELECT count(*) AS n FROM clusters').get() as {
        n: number
      }
      const color = input.color ?? clusterPalette[count.n % clusterPalette.length] ?? '#868d95'
      db.query(
        'INSERT OR IGNORE INTO clusters (id, label, color, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, label, color, now())
      const created = clusters.list().find((c) => c.id === id)
      return created
        ? ok(created)
        : err({ kind: 'unknown-cluster', cluster: id, known: clusterIds() })
    },

    rename: (id: string, label: string): Result<Cluster, LedgerFailure> => {
      if (!clusterExists(id))
        return err({
          kind: 'unknown-cluster',
          cluster: id,
          known: clusterIds(),
        })
      db.query('UPDATE clusters SET label = ? WHERE id = ?').run(label, id)
      const updated = clusters.list().find((c) => c.id === id)
      return updated
        ? ok(updated)
        : err({ kind: 'unknown-cluster', cluster: id, known: clusterIds() })
    },
  }

  // ------------------------------------------------------------------- agents

  const agents = {
    list: (): Agent[] =>
      db
        .query('SELECT * FROM agents ORDER BY last_seen DESC')
        .all()
        .map((r) => {
          const row = r as Record<string, string & number>
          return {
            id: String(row['id']),
            label: String(row['label']),
            role: String(row['role']),
            color: String(row['color']),
            endpoint: String(row['endpoint']),
            readScope: String(row['read_scope']),
            writeScope: String(row['write_scope']),
            firstSeen: Number(row['first_seen']),
            lastSeen: Number(row['last_seen']),
          }
        }),

    describe: (
      id: string,
      patch: {
        role?: string
        endpoint?: string
        readScope?: string
        writeScope?: string
        label?: string
      },
    ): Agent => {
      touchAgent(id)
      const sets: string[] = []
      const values: (string | number)[] = []
      const map = {
        role: patch.role,
        endpoint: patch.endpoint,
        read_scope: patch.readScope,
        write_scope: patch.writeScope,
        label: patch.label,
      }
      for (const [column, value] of Object.entries(map)) {
        if (value !== undefined) {
          sets.push(`${column} = ?`)
          values.push(value)
        }
      }
      if (sets.length > 0) {
        db.query(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
      }
      const found = agents.list().find((a) => a.id === id)
      if (!found) throw new Error(`agent ${id} vanished mid-write`)
      return found
    },

    /** Per-agent activity for the Connections screen. */
    activity: (id: string) => {
      const dayAgo = now() - 86_400_000
      const wrote = db
        .query(`SELECT count(*) AS n FROM memories WHERE writer = ? AND deleted_at IS NULL`)
        .get(id) as { n: number }
      const calls = db
        .query('SELECT count(*) AS n FROM events WHERE agent = ? AND at >= ?')
        .get(id, dayAgo) as { n: number }
      const searches = db
        .query(
          `SELECT count(*) AS n FROM events WHERE agent = ? AND op = 'memory.search' AND at >= ?`,
        )
        .get(id, dayAgo) as { n: number }
      const withHits = db
        .query(
          `SELECT count(*) AS n FROM events
            WHERE agent = ? AND op = 'memory.search' AND at >= ? AND detail NOT LIKE '0 %'`,
        )
        .get(id, dayAgo) as { n: number }
      const top = db
        .query(
          `SELECT c.id, c.label, c.color, count(*) AS n
             FROM memories m JOIN clusters c ON c.id = m.cluster_id
             JOIN memory_readers r ON r.memory_id = m.id
            WHERE r.agent_id = ? AND m.deleted_at IS NULL
            GROUP BY c.id ORDER BY n DESC LIMIT 4`,
        )
        .all(id) as { id: string; label: string; color: string; n: number }[]
      return {
        wrote: wrote.n,
        calls: calls.n,
        // Null, not zero: an agent that has not searched has no hit rate, and
        // rendering "0%" would read as "it searches and never finds anything".
        hitRate: searches.n === 0 ? null : withHits.n / searches.n,
        top,
      }
    },

    /** Memories readable by each pair of agents — the "shared knowledge" panel. */
    overlap: () => {
      const rows = db
        .query(
          `SELECT r1.agent_id AS a, r2.agent_id AS b, count(*) AS n
             FROM memory_readers r1
             JOIN memory_readers r2 ON r1.memory_id = r2.memory_id AND r1.agent_id < r2.agent_id
             JOIN memories m ON m.id = r1.memory_id AND m.deleted_at IS NULL
            GROUP BY r1.agent_id, r2.agent_id ORDER BY n DESC`,
        )
        .all() as { a: string; b: string; n: number }[]
      return rows
    },
  }

  // ----------------------------------------------------------------- memories

  const memories = {
    write: (input: WriteInput): Result<Memory, LedgerFailure> => {
      const text = input.text.trim()
      if (!text) return err({ kind: 'invalid-input', issues: ['text is empty'] })

      const cluster = requireCluster(input.cluster)
      if (cluster.isErr()) return err(cluster.error)

      touchAgent(input.agent)
      const id = newId('m')
      const at = input.createdAt ?? now()
      const origin: MemoryOrigin = input.origin ?? (input.sourceId ? 'doc' : 'chat')

      const insert = db.transaction(() => {
        db.query(
          `INSERT INTO memories
             (id, text, kind, origin, cluster_id, writer, source_id, chunk_index, provenance,
              created_at, last_read_at, hits, source_count, pinned, archived, reviewed_at, deleted_at)
           VALUES (?, ?, 'claim', ?, ?, ?, ?, NULL, ?, ?, ?, 0, 1, 0, 0, NULL, NULL)`,
        ).run(
          id,
          text,
          origin,
          cluster.value,
          input.agent,
          input.sourceId ?? null,
          input.provenance ?? '',
          at,
          at,
        )
        addReader(id, input.agent)
        indexText(id, text)
      })
      insert()

      const row = rowById(id)
      if (!row) return err({ kind: 'unknown-memory', id })

      record(input.agent, 'memory.write', id, text)

      if (input.supersedes) {
        const prior = rowById(input.supersedes)
        if (prior) {
          openConflict(
            prior.id,
            id,
            row.cluster_id,
            'direct contradiction',
            1,
            `declared by ${input.agent} on write`,
          )
        }
      } else {
        proposeCandidates(row)
      }

      return ok(hydrate(rowById(id) ?? row, now()))
    },

    get: (id: string, readBy?: string): Result<Memory, LedgerFailure> => {
      const row = requireMemory(id)
      if (row.isErr()) return err(row.error)
      if (readBy) {
        memories.countReads([id], readBy)
        record(readBy, 'memory.get', id, row.value.text)
        return ok(hydrate(rowById(id) ?? row.value, now()))
      }
      return ok(hydrate(row.value, now()))
    },

    /**
     * Register that an agent retrieved these memories.
     *
     * This is the only thing that moves `used` and `fresh`, which is why it is
     * an explicit call rather than a side effect of any read.
     */
    countReads: (ids: readonly string[], agent: string): void => {
      if (ids.length === 0) return
      touchAgent(agent)
      const at = now()
      const bump = db.query('UPDATE memories SET hits = hits + 1, last_read_at = ? WHERE id = ?')
      const apply = db.transaction(() => {
        for (const id of ids) {
          bump.run(at, id)
          addReader(id, agent)
        }
      })
      apply()
    },

    search: (input: SearchInput): Result<SearchResult, LedgerFailure> => {
      const started = performance.now()
      const parsed = parseQuery(input.query, now())
      if (parsed.isErr()) return err(parsed.error)
      const q = parsed.value
      const mode = input.mode ?? 'hybrid'

      const where: string[] = []
      const params: (string | number)[] = []

      if (q.asOf !== null) {
        where.push('m.created_at <= ?', '(m.deleted_at IS NULL OR m.deleted_at > ?)')
        params.push(q.asOf, q.asOf)
      } else {
        where.push('m.deleted_at IS NULL')
      }

      const kind = input.kind ?? 'all'
      if (kind !== 'all') {
        where.push('m.kind = ?')
        params.push(kind)
      }
      if (q.kind.length > 0) {
        where.push(`m.kind IN (${q.kind.map(() => '?').join(',')})`)
        params.push(...q.kind)
      }
      if (!input.includeArchived) where.push('m.archived = 0')
      if (input.pendingOnly) where.push("m.reviewed_at IS NULL AND m.kind = 'claim'")
      if (input.pinnedOnly) where.push('m.pinned = 1')
      if (input.conflictedOnly) {
        where.push(
          "EXISTS (SELECT 1 FROM conflicts cf WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id))",
        )
      }
      if (q.cluster.length > 0) {
        where.push(`m.cluster_id IN (${q.cluster.map(() => '?').join(',')})`)
        params.push(...q.cluster)
      }
      if (q.type.length > 0) {
        where.push(`m.origin IN (${q.type.map(() => '?').join(',')})`)
        params.push(...q.type)
      }
      if (q.agent.length > 0) {
        where.push(
          `EXISTS (SELECT 1 FROM memory_readers r WHERE r.memory_id = m.id AND r.agent_id IN (${q.agent
            .map(() => '?')
            .join(',')}))`,
        )
        params.push(...q.agent)
      }
      if (q.before !== null) {
        where.push('m.created_at < ?')
        params.push(q.before)
      }
      if (q.after !== null) {
        where.push('m.created_at > ?')
        params.push(q.after)
      }

      const relevance = new Map<string, number>()
      if (q.terms.length > 0) {
        const expression = ftsQuery(q.terms, mode !== 'keyword')
        if (expression && mode !== 'fuzzy') {
          const matches = db
            .query(
              `SELECT id, bm25(memories_fts) AS score FROM memories_fts
                WHERE memories_fts MATCH ? ORDER BY score LIMIT ?`,
            )
            .all(expression, SCAN_LIMIT) as { id: string; score: number }[]
          for (const m of matches) relevance.set(m.id, normaliseBm25(m.score))
        }

        if (mode !== 'keyword') {
          // Widen with character-level fuzz for typos and inflections BM25 misses.
          const phrase = q.terms.join(' ')
          const pool = db
            .query(`SELECT m.id, m.text FROM memories m WHERE ${where.join(' AND ')} LIMIT ?`)
            .all(...params, SCAN_LIMIT) as { id: string; text: string }[]
          for (const row of pool) {
            if (relevance.has(row.id)) continue
            const score = fuzzyScore(phrase, row.text)
            if (score >= FUZZY_FLOOR) relevance.set(row.id, score * 0.6)
          }
        }

        if (relevance.size === 0) {
          return ok({
            hits: [],
            total: 0,
            tookMs: performance.now() - started,
            capped: false,
          })
        }
        const ids = [...relevance.keys()]
        where.push(`m.id IN (${ids.map(() => '?').join(',')})`)
        params.push(...ids)
      }

      const clause = where.join(' AND ')
      const rows = db
        .query(`${SELECT_MEMORY} WHERE ${clause} LIMIT ?`)
        .all(...params, SCAN_LIMIT) as MemoryRow[]
      const capped = rows.length === SCAN_LIMIT

      const at = now()
      let candidates = rows.map((row) => {
        const memory = hydrate(row, at)
        const relevanceScore = q.terms.length > 0 ? (relevance.get(row.id) ?? 0) : 1
        return { ...memory, score: rank(relevanceScore, memory.strength) }
      })

      if (q.strength) {
        const { op, value } = q.strength
        candidates = candidates.filter((m) =>
          op === '<' ? m.strength < value : m.strength > value,
        )
      }

      const sort = input.sort ?? (q.terms.length > 0 ? 'relevance' : 'strength')
      const dir = input.dir === 'asc' ? 1 : -1
      const key = {
        relevance: (m: SearchHit) => m.score,
        strength: (m: SearchHit) => m.strength,
        hits: (m: SearchHit) => m.hits,
        created: (m: SearchHit) => m.createdAt,
        last: (m: SearchHit) => m.lastReadAt,
      }[sort]
      candidates.sort((a, b) => (key(a) - key(b)) * dir)

      const offset = input.offset ?? 0
      const limit = input.limit ?? 50
      const page = candidates.slice(offset, offset + limit)

      if (input.countRead && input.agent) {
        memories.countReads(
          page.map((m) => m.id),
          input.agent,
        )
      }
      if (input.agent) {
        record(
          input.agent,
          'memory.search',
          null,
          `${candidates.length} for "${input.query}"`,
          performance.now() - started,
        )
      }

      return ok({
        hits: page,
        total: candidates.length,
        tookMs: performance.now() - started,
        capped,
      })
    },

    update: (
      id: string,
      patch: {
        text?: string
        cluster?: string
        provenance?: string
      },
      agent: string,
    ): Result<Memory, LedgerFailure> => {
      const existing = requireMemory(id)
      if (existing.isErr()) return err(existing.error)

      if (patch.cluster !== undefined) {
        const cluster = requireCluster(patch.cluster)
        if (cluster.isErr()) return err(cluster.error)
      }

      const apply = db.transaction(() => {
        if (patch.text !== undefined) {
          db.query('UPDATE memories SET text = ? WHERE id = ?').run(patch.text.trim(), id)
          indexText(id, patch.text.trim())
        }
        if (patch.cluster !== undefined) {
          db.query('UPDATE memories SET cluster_id = ? WHERE id = ?').run(patch.cluster, id)
        }
        if (patch.provenance !== undefined) {
          db.query('UPDATE memories SET provenance = ? WHERE id = ?').run(patch.provenance, id)
        }
      })
      apply()
      record(agent, 'memory.update', id, patch.text ?? existing.value.text)
      const row = rowById(id)
      return row ? ok(hydrate(row, now())) : err({ kind: 'unknown-memory', id })
    },

    pin: (ids: readonly string[], pinned: boolean, agent: string): number => {
      const set = db.query("UPDATE memories SET pinned = ? WHERE id = ? AND kind = 'claim'")
      const apply = db.transaction(() => {
        for (const id of ids) set.run(pinned ? 1 : 0, id)
      })
      apply()
      record(agent, pinned ? 'memory.pin' : 'memory.unpin', null, `${ids.length} memories`)
      return ids.length
    },

    archive: (ids: readonly string[], archived: boolean, agent: string): number => {
      const set = db.query('UPDATE memories SET archived = ? WHERE id = ?')
      const apply = db.transaction(() => {
        for (const id of ids) set.run(archived ? 1 : 0, id)
      })
      apply()
      record(
        agent,
        archived ? 'memory.archive' : 'memory.unarchive',
        null,
        `${ids.length} memories`,
      )
      return ids.length
    },

    remove: (ids: readonly string[], agent: string): number => {
      const apply = db.transaction(() => {
        for (const id of ids) softDelete(id, agent, 'dropped')
      })
      apply()
      return ids.length
    },

    /**
     * Fold several memories into the first.
     *
     * Hits are summed and readers unioned because the merged memory genuinely
     * carries all that evidence — losing it would understate the strength of
     * the thing that survives.
     */
    merge: (ids: readonly string[], agent: string): Result<Memory, LedgerFailure> => {
      if (ids.length < 2) {
        return err({
          kind: 'invalid-input',
          issues: ['merge needs at least two memories'],
        })
      }
      const [keepId, ...rest] = ids
      if (keepId === undefined) return err({ kind: 'invalid-input', issues: ['no memories given'] })
      const keep = requireMemory(keepId)
      if (keep.isErr()) return err(keep.error)

      const apply = db.transaction(() => {
        for (const id of rest) {
          const row = rowById(id)
          if (!row) continue
          db.query(
            `UPDATE memories SET hits = hits + ?, source_count = source_count + ?,
                    last_read_at = max(last_read_at, ?) WHERE id = ?`,
          ).run(row.hits, row.source_count, row.last_read_at, keepId)
          db.query(
            'INSERT OR IGNORE INTO memory_readers (memory_id, agent_id) SELECT ?, agent_id FROM memory_readers WHERE memory_id = ?',
          ).run(keepId, id)
          softDelete(id, agent, `merged into ${keepId}`)
        }
      })
      apply()
      record(agent, 'memory.merge', keepId, `${ids.length} into 1`)
      const row = rowById(keepId)
      return row ? ok(hydrate(row, now())) : err({ kind: 'unknown-memory', id: keepId })
    },

    link: (a: string, b: string, agent: string): Result<void, LedgerFailure> => {
      const left = requireMemory(a)
      if (left.isErr()) return err(left.error)
      const right = requireMemory(b)
      if (right.isErr()) return err(right.error)
      const [x, y] = pairKey(a, b)
      db.query('INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)').run(x, y)
      record(agent, 'memory.link', a, `linked to ${b}`)
      return ok(undefined)
    },

    /** Linked memories, falling back to cluster siblings when nothing is linked. */
    related: (id: string, limit = 5): Memory[] => {
      const linked = db
        .query(
          `${SELECT_MEMORY}
            WHERE m.deleted_at IS NULL AND m.id IN (
              SELECT CASE WHEN l.a = ? THEN l.b ELSE l.a END FROM links l WHERE l.a = ? OR l.b = ?
            ) LIMIT ?`,
        )
        .all(id, id, id, limit) as MemoryRow[]
      if (linked.length > 0) return linked.map((r) => hydrate(r, now()))

      const source = rowById(id)
      if (!source) return []
      const siblings = db
        .query(
          `${SELECT_MEMORY}
            WHERE m.deleted_at IS NULL AND m.cluster_id = ? AND m.id != ? AND m.kind = 'claim'
            ORDER BY m.hits DESC LIMIT ?`,
        )
        .all(source.cluster_id, id, limit) as MemoryRow[]
      return siblings.map((r) => hydrate(r, now()))
    },

    exportJsonl: (ids: readonly string[]): string =>
      ids
        .map((id) => rowById(id))
        .filter((row): row is MemoryRow => row !== null)
        .map((row) => JSON.stringify(hydrate(row, now())))
        .join('\n'),

    /** Facet counts for the Browse sidebar, over everything not deleted. */
    facets: () => {
      const counts = <T>(sql: string): T[] => db.query(sql).all() as T[]
      return {
        origin: counts<{ origin: string; n: number }>(
          'SELECT origin, count(*) AS n FROM memories WHERE deleted_at IS NULL GROUP BY origin',
        ),
        cluster: counts<{ cluster_id: string; n: number }>(
          'SELECT cluster_id, count(*) AS n FROM memories WHERE deleted_at IS NULL GROUP BY cluster_id',
        ),
        agent: counts<{ agent_id: string; n: number }>(
          `SELECT r.agent_id, count(*) AS n FROM memory_readers r
             JOIN memories m ON m.id = r.memory_id AND m.deleted_at IS NULL GROUP BY r.agent_id`,
        ),
        flags: db
          .query(
            `SELECT
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND pinned = 1) AS pinned,
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND archived = 1) AS archived,
               (SELECT count(*) FROM conflicts WHERE status = 'open') AS conflicted,
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND reviewed_at IS NULL AND kind = 'claim') AS pending`,
          )
          .get() as {
          pinned: number
          archived: number
          conflicted: number
          pending: number
        },
      }
    },
  }

  // ------------------------------------------------------------------ review

  const review = {
    /**
     * Claims nobody has looked at yet.
     *
     * Pending claims are already searchable — review is an audit, not a gate.
     * A memory store that only works once you have cleared a queue is a memory
     * store that does not work.
     */
    pending: (limit = 50): Memory[] =>
      (
        db
          .query(
            `${SELECT_MEMORY}
              WHERE m.deleted_at IS NULL AND m.kind = 'claim' AND m.reviewed_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM conflicts cf WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id))
              ORDER BY m.created_at DESC LIMIT ?`,
          )
          .all(limit) as MemoryRow[]
      ).map((r) => hydrate(r, now())),

    keep: (id: string, agent: string): Result<Memory, LedgerFailure> => {
      const row = requireMemory(id)
      if (row.isErr()) return err(row.error)
      if (row.value.kind === 'chunk') return err({ kind: 'not-a-claim', id, actual: 'chunk' })
      db.query('UPDATE memories SET reviewed_at = ? WHERE id = ?').run(now(), id)
      record(agent, 'review.keep', id, row.value.text)
      const updated = rowById(id)
      return updated ? ok(hydrate(updated, now())) : err({ kind: 'unknown-memory', id })
    },

    pin: (id: string, agent: string): Result<Memory, LedgerFailure> => {
      const row = requireMemory(id)
      if (row.isErr()) return err(row.error)
      if (row.value.kind === 'chunk') return err({ kind: 'not-a-claim', id, actual: 'chunk' })
      db.query('UPDATE memories SET reviewed_at = ?, pinned = 1 WHERE id = ?').run(now(), id)
      record(agent, 'review.pin', id, row.value.text)
      const updated = rowById(id)
      return updated ? ok(hydrate(updated, now())) : err({ kind: 'unknown-memory', id })
    },

    drop: (id: string, agent: string): Result<void, LedgerFailure> => {
      const row = requireMemory(id)
      if (row.isErr()) return err(row.error)
      softDelete(id, agent, 'dropped in review')
      return ok(undefined)
    },

    edit: (id: string, text: string, agent: string): Result<Memory, LedgerFailure> => {
      const updated = memories.update(id, { text }, agent)
      if (updated.isErr()) return updated
      db.query('UPDATE memories SET reviewed_at = ? WHERE id = ?').run(now(), id)
      const row = rowById(id)
      return row ? ok(hydrate(row, now())) : err({ kind: 'unknown-memory', id })
    },
  }

  // --------------------------------------------------------------- conflicts

  const conflicts = {
    /** Pairs waiting for an agent's judgement, most suspicious first. */
    candidates: (limit = 20): ConflictCandidate[] => {
      const rows = db
        .query(
          `SELECT * FROM conflict_candidates
            WHERE judged_at IS NULL ORDER BY score DESC LIMIT ?`,
        )
        .all(limit) as {
        id: string
        a: string
        b: string
        score: number
        signals: string
        created_at: number
      }[]

      const at = now()
      return rows.flatMap((row) => {
        const a = rowById(row.a)
        const b = rowById(row.b)
        if (!a || !b || a.deleted_at !== null || b.deleted_at !== null) return []
        return [
          {
            id: row.id,
            a: hydrate(a, at),
            b: hydrate(b, at),
            score: row.score,
            signals: row.signals ? row.signals.split(', ') : [],
            createdAt: row.created_at,
          },
        ]
      })
    },

    /** An agent's verdict on a candidate. Either it becomes a conflict, or it is settled. */
    judge: (input: JudgeInput): Result<Conflict | null, LedgerFailure> => {
      const row = db
        .query('SELECT * FROM conflict_candidates WHERE id = ? AND judged_at IS NULL')
        .get(input.candidateId) as { id: string; a: string; b: string } | null
      if (!row) return err({ kind: 'unknown-candidate', id: input.candidateId })

      touchAgent(input.agent)
      db.query('UPDATE conflict_candidates SET judged_at = ? WHERE id = ?').run(
        now(),
        input.candidateId,
      )

      if (input.verdict === 'unrelated') {
        record(input.agent, 'conflicts.judge', row.a, `not a conflict with ${row.b}`)
        return ok(null)
      }

      const a = rowById(row.a)
      if (!a) return err({ kind: 'unknown-memory', id: row.a })
      const conflict = openConflict(
        row.a,
        row.b,
        a.cluster_id,
        input.kind ?? 'direct contradiction',
        input.detector ?? 0.8,
        input.note ?? '',
      )
      record(input.agent, 'conflicts.judge', row.a, `conflicts with ${row.b}`)
      return ok(conflict)
    },

    get: (id: string): Conflict | null => {
      const row = db.query('SELECT * FROM conflicts WHERE id = ?').get(id) as {
        id: string
        kind: string
        cluster_id: string
        a: string
        b: string
        detector: number
        note: string
        status: string
        created_at: number
        resolved_at: number | null
      } | null
      if (!row) return null
      const a = rowById(row.a)
      const b = rowById(row.b)
      if (!a || !b) return null
      const at = now()
      return {
        id: row.id,
        kind: row.kind as ConflictKind,
        clusterId: row.cluster_id,
        a: hydrate(a, at),
        b: hydrate(b, at),
        detector: row.detector,
        note: row.note,
        status: row.status as Conflict['status'],
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }
    },

    open: (limit = 50): Conflict[] =>
      (
        db
          .query("SELECT id FROM conflicts WHERE status = 'open' ORDER BY created_at DESC LIMIT ?")
          .all(limit) as { id: string }[]
      ).flatMap((r) => {
        const c = conflicts.get(r.id)
        return c ? [c] : []
      }),

    /**
     * Settle a conflict.
     *
     * `a` / `b` retire the loser, `both` records that the two are related
     * rather than contradictory, `merge` folds the newer text into the older
     * memory so its accumulated evidence survives, `dismiss` says the detector
     * was wrong.
     */
    resolve: (
      id: string,
      resolution: ConflictResolution,
      agent: string,
    ): Result<void, LedgerFailure> => {
      const conflict = conflicts.get(id)
      if (conflict?.status !== 'open') return err({ kind: 'unknown-conflict', id })
      const at = now()

      const settle = (status: 'resolved' | 'dismissed'): void => {
        db.query('UPDATE conflicts SET status = ?, resolved_at = ? WHERE id = ?').run(
          status,
          at,
          id,
        )
      }

      switch (resolution) {
        case 'a':
        case 'b': {
          const loser = resolution === 'a' ? conflict.b : conflict.a
          const winner = resolution === 'a' ? conflict.a : conflict.b
          settle('resolved')
          db.query('UPDATE memories SET reviewed_at = ? WHERE id = ?').run(at, winner.id)
          softDelete(loser.id, agent, `retired resolving conflict ${id}`)
          break
        }
        case 'merge': {
          settle('resolved')
          db.query(
            `UPDATE memories SET text = ?, hits = hits + ?, source_count = source_count + ?, reviewed_at = ?
              WHERE id = ?`,
          ).run(conflict.b.text, conflict.b.hits, conflict.b.sourceCount, at, conflict.a.id)
          indexText(conflict.a.id, conflict.b.text)
          softDelete(conflict.b.id, agent, `merged into ${conflict.a.id}`)
          break
        }
        case 'both': {
          settle('resolved')
          const [x, y] = pairKey(conflict.a.id, conflict.b.id)
          db.query('INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)').run(x, y)
          db.query('UPDATE memories SET reviewed_at = ? WHERE id IN (?, ?)').run(
            at,
            conflict.a.id,
            conflict.b.id,
          )
          break
        }
        case 'dismiss': {
          settle('dismissed')
          db.query('UPDATE memories SET reviewed_at = ? WHERE id IN (?, ?)').run(
            at,
            conflict.a.id,
            conflict.b.id,
          )
          break
        }
      }

      record(agent, 'conflicts.resolve', conflict.a.id, `${resolution} on ${id}`)
      return ok(undefined)
    },
  }

  // ----------------------------------------------------------------- sources

  const sources = {
    list: (): SourceSummary[] =>
      (
        db
          .query(
            `SELECT s.*,
                    (SELECT count(*) FROM memories m WHERE m.source_id = s.id AND m.kind = 'chunk' AND m.deleted_at IS NULL) AS chunk_count,
                    (SELECT count(*) FROM memories m WHERE m.source_id = s.id AND m.kind = 'claim' AND m.deleted_at IS NULL) AS claim_count,
                    (SELECT coalesce(sum(m.hits), 0) FROM memories m WHERE m.source_id = s.id AND m.deleted_at IS NULL) AS hits
               FROM sources s WHERE s.dropped_at IS NULL ORDER BY s.ingested_at DESC`,
          )
          .all() as Record<string, string & number>[]
      ).map((row) => ({
        id: String(row['id']),
        filename: String(row['filename']),
        ext: String(row['ext']),
        clusterId: String(row['cluster_id']),
        ingestedBy: String(row['ingested_by']),
        bytes: Number(row['bytes']),
        trust: Number(row['trust']),
        ingestedAt: Number(row['ingested_at']),
        droppedAt: null,
        chunkCount: Number(row['chunk_count']),
        claimCount: Number(row['claim_count']),
        hits: Number(row['hits']),
      })),

    /** Chunks of a source, in document order. */
    chunks: (id: string, limit = 4): Memory[] =>
      (
        db
          .query(
            `${SELECT_MEMORY}
              WHERE m.source_id = ? AND m.kind = 'chunk' AND m.deleted_at IS NULL
              ORDER BY m.chunk_index LIMIT ?`,
          )
          .all(id, limit) as MemoryRow[]
      ).map((r) => hydrate(r, now())),

    /** Claims an agent distilled from a source — these *do* enter the review queue. */
    claims: (id: string): Memory[] =>
      (
        db
          .query(
            `${SELECT_MEMORY}
              WHERE m.source_id = ? AND m.kind = 'claim' AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC`,
          )
          .all(id) as MemoryRow[]
      ).map((r) => hydrate(r, now())),

    ingest: (input: IngestInput): Result<{ source: Source; chunks: number }, LedgerFailure> => {
      const cluster = requireCluster(input.cluster)
      if (cluster.isErr()) return err(cluster.error)
      if (!input.text.trim()) {
        return err({ kind: 'invalid-input', issues: ['source text is empty'] })
      }

      touchAgent(input.agent)
      const id = newId('s')
      const at = now()
      const pieces = chunkText(input.text, DEFAULT_CHUNKING)
      const trust = Math.max(0, Math.min(1, input.trust ?? 0.75))

      const apply = db.transaction(() => {
        db.query(
          `INSERT INTO sources (id, filename, ext, cluster_id, ingested_by, bytes, trust, ingested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.filename,
          extensionOf(input.filename),
          cluster.value,
          input.agent,
          input.bytes ?? input.text.length,
          trust,
          at,
        )

        pieces.forEach((text, index) => {
          const chunkId = newId('c')
          db.query(
            `INSERT INTO memories
               (id, text, kind, origin, cluster_id, writer, source_id, chunk_index, provenance,
                created_at, last_read_at, hits, source_count, pinned, archived, reviewed_at, deleted_at)
             VALUES (?, ?, 'chunk', 'doc', ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 0, ?, NULL)`,
          ).run(
            chunkId,
            text,
            cluster.value,
            input.agent,
            id,
            index + 1,
            `chunk ${index + 1} of ${pieces.length} · ${input.filename}`,
            at,
            at,
            at,
          )
          addReader(chunkId, input.agent)
          indexText(chunkId, text)
        })
      })
      apply()

      record(input.agent, 'sources.ingest', null, `${input.filename} · ${pieces.length} chunks`)
      const source = sources.list().find((s) => s.id === id)
      return source ? ok({ source, chunks: pieces.length }) : err({ kind: 'unknown-source', id })
    },

    trust: (id: string, value: number, agent: string): Result<void, LedgerFailure> => {
      const exists = db.query('SELECT 1 FROM sources WHERE id = ?').get(id)
      if (!exists) return err({ kind: 'unknown-source', id })
      db.query('UPDATE sources SET trust = ? WHERE id = ?').run(Math.max(0, Math.min(1, value)), id)
      record(agent, 'sources.trust', null, `${id} → ${Math.round(value * 100)}`)
      return ok(undefined)
    },

    /**
     * Drop a source and everything that came out of it.
     *
     * Chunks go — they have no meaning without the document. Claims distilled
     * from it survive, because an agent already judged them worth keeping and
     * they may be corroborated elsewhere. They do go back into the review
     * queue: the evidence behind them just disappeared, so the judgement that
     * kept them deserves to be made again.
     */
    drop: (
      id: string,
      agent: string,
    ): Result<{ chunks: number; flagged: number }, LedgerFailure> => {
      const exists = db
        .query('SELECT filename FROM sources WHERE id = ? AND dropped_at IS NULL')
        .get(id) as { filename: string } | null
      if (!exists) return err({ kind: 'unknown-source', id })

      const chunkIds = (
        db
          .query(
            "SELECT id FROM memories WHERE source_id = ? AND kind = 'chunk' AND deleted_at IS NULL",
          )
          .all(id) as { id: string }[]
      ).map((r) => r.id)
      const claimIds = (
        db
          .query(
            "SELECT id FROM memories WHERE source_id = ? AND kind = 'claim' AND deleted_at IS NULL",
          )
          .all(id) as { id: string }[]
      ).map((r) => r.id)

      const apply = db.transaction(() => {
        for (const chunkId of chunkIds) softDelete(chunkId, agent, `source ${id} dropped`)
        for (const claimId of claimIds) {
          db.query('UPDATE memories SET reviewed_at = NULL WHERE id = ?').run(claimId)
        }
        db.query('UPDATE sources SET dropped_at = ? WHERE id = ?').run(now(), id)
      })
      apply()

      record(agent, 'sources.drop', null, `${exists.filename} · ${chunkIds.length} chunks removed`)
      return ok({ chunks: chunkIds.length, flagged: claimIds.length })
    },
  }

  // ------------------------------------------------------------------- stats

  const events = (limit = 20): LogEntry[] =>
    (
      db.query('SELECT * FROM events ORDER BY at DESC, id DESC LIMIT ?').all(limit) as Record<
        string,
        string & number
      >[]
    ).map((row) => ({
      id: Number(row['id']),
      at: Number(row['at']),
      agent: String(row['agent']),
      op: String(row['op']),
      memoryId: row['memory_id'] === null ? null : String(row['memory_id']),
      detail: String(row['detail']),
    }))

  const stats = (): Stats => {
    const startOfDay = new Date(now()).setHours(0, 0, 0, 0)
    const one = <T>(sql: string, ...params: (string | number)[]): T =>
      db.query(sql).get(...params) as T

    const totals = one<{
      memories: number
      claims: number
      chunks: number
      pending: number
    }>(
      `SELECT count(*) AS memories,
              sum(kind = 'claim') AS claims,
              sum(kind = 'chunk') AS chunks,
              sum(kind = 'claim' AND reviewed_at IS NULL) AS pending
         FROM memories WHERE deleted_at IS NULL`,
    )

    const searchTimes = (
      db
        .query(
          `SELECT ms FROM events WHERE op = 'memory.search' AND ms IS NOT NULL AND at >= ? ORDER BY ms`,
        )
        .all(startOfDay) as { ms: number }[]
    ).map((r) => r.ms)

    return {
      memories: totals.memories,
      claims: totals.claims ?? 0,
      chunks: totals.chunks ?? 0,
      pending: totals.pending ?? 0,
      conflicts: one<{ n: number }>("SELECT count(*) AS n FROM conflicts WHERE status = 'open'").n,
      candidates: one<{ n: number }>(
        'SELECT count(*) AS n FROM conflict_candidates WHERE judged_at IS NULL',
      ).n,
      sources: one<{ n: number }>('SELECT count(*) AS n FROM sources WHERE dropped_at IS NULL').n,
      agents: one<{ n: number }>('SELECT count(*) AS n FROM agents').n,
      requestsToday: one<{ n: number }>(
        'SELECT count(*) AS n FROM events WHERE at >= ?',
        startOfDay,
      ).n,
      diskBytes: options.path === ':memory:' ? 0 : (Bun.file(options.path).size ?? 0),
      startedAt: openedAt,
      p50SearchMs: searchTimes[Math.floor(searchTimes.length / 2)] ?? 0,
      lastWriteAt:
        one<{ at: number | null }>(
          "SELECT max(at) AS at FROM events WHERE op IN ('memory.write', 'sources.ingest')",
        ).at ?? null,
    }
  }

  /** Histogram of memory creation over the store's lifetime, for the canvas scrubber. */
  const timeline = (buckets = 60): { at: number; n: number }[] => {
    const span = db
      .query('SELECT min(created_at) AS lo, max(created_at) AS hi FROM memories')
      .get() as {
      lo: number | null
      hi: number | null
    }
    if (span.lo === null || span.hi === null) return []
    const lo = span.lo
    const width = Math.max(1, (span.hi - lo) / buckets)
    const rows = db
      .query(
        `SELECT cast((created_at - ?) / ? AS INTEGER) AS bucket, count(*) AS n
           FROM memories WHERE deleted_at IS NULL GROUP BY bucket`,
      )
      .all(lo, width) as { bucket: number; n: number }[]
    const counts = new Map(rows.map((r) => [Math.min(r.bucket, buckets - 1), r.n]))
    return Array.from({ length: buckets }, (_, i) => ({
      at: lo + i * width,
      n: counts.get(i) ?? 0,
    }))
  }

  return {
    db,
    now,
    close: (): void => db.close(),
    clusters,
    agents,
    memories,
    review,
    conflicts,
    sources,
    events,
    stats,
    timeline,
    parse: (query: string): Result<ParsedQuery, LedgerFailure> => parseQuery(query, now()),
  }
}
