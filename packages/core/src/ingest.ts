import { err, ok, type Result } from 'neverthrow'
import type { LedgerFailure } from './errors.ts'

/**
 * Formats the server will read off disk itself. Everything else — PDF, docx,
 * anything needing a parser — is the agent's job: it already has file-reading
 * tools, and bundling a PDF stack into a memory store buys little.
 */
export const NATIVE_EXTENSIONS = [
  'md',
  'markdown',
  'txt',
  'text',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'log',
  'yaml',
  'yml',
] as const

export const isNative = (filename: string): boolean =>
  (NATIVE_EXTENSIONS as readonly string[]).includes(extensionOf(filename))

export const extensionOf = (filename: string): string =>
  filename.includes('.') ? (filename.split('.').pop() ?? '').toLowerCase() : ''

export type SourceText = {
  readonly filename: string
  readonly ext: string
  readonly text: string
  readonly bytes: number
}

/** Read and decode a natively-supported file. */
export const readSourceFile = async (path: string): Promise<Result<SourceText, LedgerFailure>> => {
  const filename = path.split('/').pop() ?? path
  const ext = extensionOf(filename)

  if (!isNative(filename)) {
    return err({
      kind: 'unreadable-source',
      path,
      reason: `.${ext || 'unknown'} needs a parser this server does not bundle`,
    })
  }

  const file = Bun.file(path)
  if (!(await file.exists())) {
    return err({ kind: 'unreadable-source', path, reason: 'no such file' })
  }

  const text = await file.text()
  if (!text.trim()) {
    return err({ kind: 'unreadable-source', path, reason: 'file is empty' })
  }

  return ok({ filename, ext, text, bytes: file.size })
}

export type ChunkOptions = {
  /** Characters to aim for per chunk. */
  readonly target: number
  /** Hard ceiling; a paragraph longer than this is split at sentence boundaries. */
  readonly max: number
}

export const DEFAULT_CHUNKING: ChunkOptions = { target: 900, max: 1600 }

const splitLongBlock = (block: string, max: number): string[] => {
  const sentences = block.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [block]
  const out: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > max) {
      out.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) out.push(current.trim())
  return out
}

/**
 * Split a document into chunks on natural boundaries.
 *
 * Blank lines separate blocks, blocks are packed up to `target`, and a markdown
 * heading always starts a new chunk so a section's title stays attached to the
 * text it introduces — retrieval is far more useful when a chunk carries its
 * own heading.
 */
export const chunkText = (text: string, options: ChunkOptions = DEFAULT_CHUNKING): string[] => {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  const flush = (): void => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const block of blocks) {
    const isHeading = /^#{1,6}\s/.test(block)
    if (isHeading && current) flush()

    if (block.length > options.max) {
      flush()
      chunks.push(...splitLongBlock(block, options.max))
      continue
    }

    if (current && current.length + block.length + 2 > options.target) flush()
    current = current ? `${current}\n\n${block}` : block
  }
  flush()

  return chunks.length > 0 ? chunks : [text.trim()]
}
