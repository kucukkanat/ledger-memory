import { clusterColor } from '@ledger/tokens'

export const SCHEMA_VERSION = 1

/**
 * The store's shape.
 *
 * Two decisions are worth calling out:
 *
 * 1. **Deletes are soft.** `asof:2026-01-01` has to answer "what did the fleet
 *    believe on that date", which is a question a hard delete destroys. Rows
 *    stay, `deleted_at` is stamped, and every live query filters on it.
 *
 * 2. **Strength is absent.** It is recomputed from `hits`, `last_read_at`,
 *    `source_count` and the reader set on every read. Storing it would let a
 *    number drift away from the evidence that justifies it.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clusters (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL,
  endpoint    TEXT NOT NULL DEFAULT '',
  read_scope  TEXT NOT NULL DEFAULT 'all clusters',
  write_scope TEXT NOT NULL DEFAULT 'all clusters',
  first_seen  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  ext         TEXT NOT NULL,
  cluster_id  TEXT NOT NULL REFERENCES clusters(id),
  ingested_by TEXT NOT NULL,
  bytes       INTEGER NOT NULL DEFAULT 0,
  trust       REAL NOT NULL DEFAULT 0.7,
  ingested_at INTEGER NOT NULL,
  dropped_at  INTEGER
);

CREATE TABLE IF NOT EXISTS memories (
  id           TEXT PRIMARY KEY,
  text         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('claim', 'chunk')),
  origin       TEXT NOT NULL CHECK (origin IN ('chat', 'doc')),
  cluster_id   TEXT NOT NULL REFERENCES clusters(id),
  writer       TEXT NOT NULL,
  source_id    TEXT REFERENCES sources(id),
  chunk_index  INTEGER,
  provenance   TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  last_read_at INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 1,
  pinned       INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0,
  reviewed_at  INTEGER,
  deleted_at   INTEGER
);

CREATE INDEX IF NOT EXISTS memories_live    ON memories (deleted_at, kind, cluster_id);
CREATE INDEX IF NOT EXISTS memories_created ON memories (created_at);
CREATE INDEX IF NOT EXISTS memories_pending ON memories (reviewed_at) WHERE kind = 'claim';
CREATE INDEX IF NOT EXISTS memories_source  ON memories (source_id);

CREATE TABLE IF NOT EXISTS memory_readers (
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  agent_id  TEXT NOT NULL,
  PRIMARY KEY (memory_id, agent_id)
);
CREATE INDEX IF NOT EXISTS memory_readers_agent ON memory_readers (agent_id);

CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag)
);
CREATE INDEX IF NOT EXISTS memory_tags_tag ON memory_tags (tag);

CREATE TABLE IF NOT EXISTS links (
  a TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  b TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS links_b ON links (b);

CREATE TABLE IF NOT EXISTS conflicts (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  cluster_id  TEXT NOT NULL REFERENCES clusters(id),
  a           TEXT NOT NULL REFERENCES memories(id),
  b           TEXT NOT NULL REFERENCES memories(id),
  detector    REAL NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS conflicts_status ON conflicts (status);
CREATE INDEX IF NOT EXISTS conflicts_a ON conflicts (a);
CREATE INDEX IF NOT EXISTS conflicts_b ON conflicts (b);

-- Pairs the server suspects. A candidate is a question for an agent, never a verdict.
CREATE TABLE IF NOT EXISTS conflict_candidates (
  id         TEXT PRIMARY KEY,
  a          TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  b          TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  score      REAL NOT NULL,
  signals    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  judged_at  INTEGER,
  UNIQUE (a, b)
);
CREATE INDEX IF NOT EXISTS candidates_pending ON conflict_candidates (judged_at, score);

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  agent     TEXT NOT NULL,
  op        TEXT NOT NULL,
  memory_id TEXT,
  detail    TEXT NOT NULL DEFAULT '',
  ms        REAL
);
CREATE INDEX IF NOT EXISTS events_at ON events (at DESC);

-- Standalone rather than external-content: keeping an FTS index in sync by hand
-- inside the same transaction is less machinery than four triggers, and the
-- duplicated text costs little at personal-store scale.
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  text,
  tokenize = 'porter unicode61'
);
`

/** The starting taxonomy, editable once the store exists. */
export const SEED_CLUSTERS: readonly {
  id: string
  label: string
  color: string
}[] = [
  { id: 'prefs', label: 'preferences', color: clusterColor.prefs },
  { id: 'people', label: 'people & orgs', color: clusterColor.people },
  { id: 'code', label: 'codebases', color: clusterColor.code },
  { id: 'travel', label: 'travel & places', color: clusterColor.travel },
  { id: 'health', label: 'health', color: clusterColor.health },
  { id: 'money', label: 'finances', color: clusterColor.money },
  { id: 'home', label: 'home & devices', color: clusterColor.home },
  { id: 'reading', label: 'reading & notes', color: clusterColor.reading },
  { id: 'proc', label: 'procedures', color: clusterColor.proc },
  { id: 'projects', label: 'projects', color: clusterColor.projects },
]
