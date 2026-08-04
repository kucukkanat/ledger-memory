import { type Result } from 'neverthrow';
import type { LedgerFailure } from './errors.ts';
/**
 * Formats the server will read off disk itself. Everything else — PDF, docx,
 * anything needing a parser — is the agent's job: it already has file-reading
 * tools, and bundling a PDF stack into a memory store buys little.
 */
export declare const NATIVE_EXTENSIONS: readonly ["md", "markdown", "txt", "text", "csv", "tsv", "json", "jsonl", "log", "yaml", "yml"];
export declare const isNative: (filename: string) => boolean;
export declare const extensionOf: (filename: string) => string;
export type SourceText = {
    readonly filename: string;
    readonly ext: string;
    readonly text: string;
    readonly bytes: number;
};
/** Read and decode a natively-supported file. */
export declare const readSourceFile: (path: string) => Promise<Result<SourceText, LedgerFailure>>;
export type ChunkOptions = {
    /** Characters to aim for per chunk. */
    readonly target: number;
    /** Hard ceiling; a paragraph longer than this is split at sentence boundaries. */
    readonly max: number;
};
export declare const DEFAULT_CHUNKING: ChunkOptions;
/**
 * Split a document into chunks on natural boundaries.
 *
 * Blank lines separate blocks, blocks are packed up to `target`, and a markdown
 * heading always starts a new chunk so a section's title stays attached to the
 * text it introduces — retrieval is far more useful when a chunk carries its
 * own heading.
 */
export declare const chunkText: (text: string, options?: ChunkOptions) => string[];
//# sourceMappingURL=ingest.d.ts.map