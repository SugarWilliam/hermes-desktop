import type { ChunkingConfig } from "./types";

/** Supported text file extensions for KB document ingestion. */
export const KB_TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".json",
  ".yaml", ".yml", ".xml", ".html",
  ".css", ".js", ".ts", ".tsx", ".jsx",
  ".py", ".sh", ".c", ".h", ".cpp", ".hpp",
  ".cc", ".cxx", ".go", ".rs", ".java",
  ".kt", ".swift", ".toml", ".ini", ".env",
]);

/** Default chunking configuration (Dify-inspired parent-child strategy). */
export const DEFAULT_CHUNKING: ChunkingConfig = {
  parentSize: 1200,
  childSize: 400,
  overlap: 80,
};

/** Maximum file size for ingestion (512 KB). */
export const MAX_FILE_SIZE = 512 * 1024;

/** Maximum files per KB to prevent runaway indexing. */
export const MAX_FILES_PER_KB = 500;

/** Minimum chunk size — chunks below this are merged with the previous sibling. */
export const MIN_CHUNK_SIZE = 200;

/** Default number of results to return from search. */
export const DEFAULT_TOP_K = 10;

/** Maximum search results allowed. */
export const MAX_TOP_K = 30;

/** FTS5 snippet window size (characters around match). */
export const SNIPPET_WINDOW = 40;

/**
 * Delimiter hierarchy for recursive chunking.
 * Headings split first (coarse), then paragraphs, lines, sentences.
 */
export const CHUNK_DELIMITERS = [
  /\n## /,
  /\n### /,
  /\n#### /,
  /\n\n/,
  /\n/,
  /\. /,
  / /,
];
