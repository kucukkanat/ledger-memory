/**
 * Every way a LEDGER operation can fail, as data.
 *
 * Fallible store operations return `Result<T, LedgerFailure>` rather than
 * throwing, so callers cannot ignore a failure by accident and the MCP layer
 * can map each variant to a message an agent can act on. Anything that throws
 * is a bug or a corrupt database — not a modelled outcome.
 */
export type LedgerFailure =
  | {
      readonly kind: 'unknown-cluster'
      readonly cluster: string
      readonly known: readonly string[]
    }
  | { readonly kind: 'unknown-memory'; readonly id: string }
  | { readonly kind: 'unknown-source'; readonly id: string }
  | { readonly kind: 'unknown-conflict'; readonly id: string }
  | { readonly kind: 'unknown-candidate'; readonly id: string }
  | {
      readonly kind: 'invalid-query'
      readonly token: string
      readonly reason: string
    }
  | { readonly kind: 'invalid-input'; readonly issues: readonly string[] }
  | {
      readonly kind: 'not-a-claim'
      readonly id: string
      readonly actual: 'chunk'
    }
  | {
      readonly kind: 'unreadable-source'
      readonly path: string
      readonly reason: string
    }

/** A one-line, agent-readable rendering of a failure. */
export const explain = (f: LedgerFailure): string => {
  switch (f.kind) {
    case 'unknown-cluster':
      return `No cluster "${f.cluster}". Known clusters: ${f.known.join(', ')}. Create it with clusters.create, or write to an existing one.`
    case 'unknown-memory':
      return `No memory ${f.id}. It may have been dropped.`
    case 'unknown-source':
      return `No source ${f.id}.`
    case 'unknown-conflict':
      return `No open conflict ${f.id}. It may already be resolved.`
    case 'unknown-candidate':
      return `No pending conflict candidate ${f.id}. It may already have been judged.`
    case 'invalid-query':
      return `Cannot parse "${f.token}": ${f.reason}`
    case 'invalid-input':
      return `Invalid input: ${f.issues.join('; ')}`
    case 'not-a-claim':
      return `${f.id} is a document chunk. Chunks are trusted or dropped with their source, never reviewed one by one.`
    case 'unreadable-source':
      return `Cannot read ${f.path}: ${f.reason}. Extract the text yourself and pass it as \`text\`.`
  }
}
