export {
  type CandidateSignal,
  contentTokens,
  OVERLAP_FLOOR,
  pairKey,
  type Suspicion,
  suspect,
} from './conflicts.ts'
export { explain, type LedgerFailure } from './errors.ts'
export { newId, slug } from './ids.ts'
export {
  type ChunkOptions,
  chunkText,
  DEFAULT_CHUNKING,
  extensionOf,
  isNative,
  NATIVE_EXTENSIONS,
  readSourceFile,
  type SourceText,
} from './ingest.ts'
export {
  FILTER_KEYS,
  type FilterKey,
  isTimeTravel,
  type ParsedQuery,
  parseDate,
  parseQuery,
  type StrengthBound,
} from './query.ts'
export { hydrate, type MemoryRow, SELECT_MEMORY } from './rows.ts'
export { DDL, SCHEMA_VERSION, SEED_CLUSTERS } from './schema.ts'
export {
  FUZZY_FLOOR,
  ftsQuery,
  fuzzyScore,
  normaliseBm25,
  rank,
} from './search.ts'
export {
  CANDIDATE_COMPARISONS,
  type IngestInput,
  type JudgeInput,
  openStore,
  SCAN_LIMIT,
  type SearchInput,
  type SearchResult,
  type SourceSummary,
  type Store,
  type StoreOptions,
  type WriteInput,
} from './store.ts'
export {
  BOUNDS,
  CHUNK_BOUNDS,
  chunkStrength,
  daysUntil,
  FRESHNESS_TAU_DAYS,
  factorsOf,
  PINNED_STRENGTH,
  type StrengthInput,
  strengthOf,
  WEIGHTS,
} from './strength.ts'
export type {
  Agent,
  Cluster,
  Conflict,
  ConflictCandidate,
  ConflictKind,
  ConflictResolution,
  ConflictStatus,
  LogEntry,
  Memory,
  MemoryKind,
  MemoryOrigin,
  SearchHit,
  SearchMode,
  Source,
  Stats,
  StrengthFactors,
} from './types.ts'
