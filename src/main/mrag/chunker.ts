import { createHash } from "crypto";
import {
  DEFAULT_CHUNKING,
  CHUNK_DELIMITERS,
} from "./constants";
import type {
  ChunkingConfig,
  ParentChunkInput,
  SubChunkInput,
} from "./types";

/**
 * MRAG Chunker — Markdown-aware recursive chunking with parent-child structure.
 * Inspired by Dify's recursive delimiter fallback + parent-child indexing.
 *
 * Algorithm:
 * 1. Split document at heading boundaries ("## ") → parent chunks
 * 2. For each parent, recursively split into sub-chunks
 * 3. Sub-chunks reference their parent; when retrieved, the full parent
 *    context is returned for completeness.
 */

/** SHA-256 hash of content for deduplication. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Walk backward from a line index to find the nearest heading. */
export function extractSectionTitle(
  lines: string[],
  startLine: number,
): string {
  for (let i = startLine; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      return trimmed.replace(/^#+\s*/, "").trim();
    }
  }
  return "";
}

/**
 * Split text using a delimiter. Returns non-empty segments.
 */
function splitByDelimiter(text: string, delimiter: RegExp): string[] {
  return text
    .split(delimiter)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Recursively split a text block into chunks of at most `targetSize` chars.
 * Tries splitters in priority order (from CHUNK_DELIMITERS) until the
 * piece fits or cannot be split further.
 */
function recursiveSplit(
  text: string,
  targetSize: number,
  overlap: number,
  delimiterIndex = 0,
): string[] {
  if (text.length <= targetSize || delimiterIndex >= CHUNK_DELIMITERS.length) {
    return [text];
  }

  const delimiter = CHUNK_DELIMITERS[delimiterIndex];
  const parts = splitByDelimiter(text, delimiter);

  if (parts.length <= 1) {
    // This delimiter didn't help — try the next one
    return recursiveSplit(text, targetSize, overlap, delimiterIndex + 1);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    if (currentChunk.length + part.length <= targetSize) {
      currentChunk = currentChunk
        ? currentChunk + "\n" + part
        : part;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If this part alone exceeds targetSize, recursively split it
      if (part.length > targetSize) {
        const subChunks = recursiveSplit(
          part,
          targetSize,
          overlap,
          delimiterIndex + 1,
        );
        chunks.push(...subChunks);
        currentChunk = "";
      } else {
        currentChunk = part;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Merge undersized chunks with previous
  return mergeSmallChunks(chunks, targetSize / 2);
}

/** Merge chunks smaller than minSize with the previous sibling. */
function mergeSmallChunks(chunks: string[], minSize: number): string[] {
  if (chunks.length <= 1) return chunks;
  const result: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].length < minSize && result.length > 0) {
      result[result.length - 1] += "\n" + chunks[i];
    } else {
      result.push(chunks[i]);
    }
  }
  return result;
}

/** Convert 0-based line index to 1-based line number for display. */
function lineNumber(lineIdx: number): number {
  return lineIdx + 1;
}

/**
 * Main chunking entry point. Returns parent chunks and sub-chunks
 * linked by a temporary local index.
 */
export function chunkDocument(
  content: string,
  docPath: string,
  config?: Partial<ChunkingConfig>,
): {
  parentChunks: ParentChunkInput[];
  subChunks: SubChunkInput[];
} {
  const cfg: ChunkingConfig = { ...DEFAULT_CHUNKING, ...config };
  const lines = content.split("\n");
  const parentChunks: ParentChunkInput[] = [];
  const subChunks: SubChunkInput[] = [];

  if (content.trim().length === 0) {
    return { parentChunks, subChunks };
  }

  // Find heading boundaries for parent-level splitting
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      headingIndices.push(i);
    }
  }

  // If no headings found, treat the whole document as one section
  if (headingIndices.length === 0) {
    headingIndices.push(0);
  }

  // Split into sections by heading boundaries
  for (let s = 0; s < headingIndices.length; s++) {
    const startLine = headingIndices[s];
    const endLine =
      s < headingIndices.length - 1
        ? headingIndices[s + 1]
        : lines.length;
    const sectionLines = lines.slice(startLine, endLine);
    const sectionText = sectionLines.join("\n");
    const sectionTitle = extractSectionTitle(lines, startLine);

    // Split section into parent-sized chunks
    const parentChunks_ = recursiveSplit(
      sectionText,
      cfg.parentSize,
      cfg.overlap,
    );

    let lineOffset = startLine;
    for (const pText of parentChunks_) {
      const pLines = pText.split("\n");
      const pStartLine = lineOffset;
      const pEndLine = lineOffset + pLines.length;
      lineOffset = pEndLine;

      const parentHash = hashContent(pText);
      const parentIdx = parentChunks.length;

      parentChunks.push({
        docPath,
        content: pText,
        startLine: lineNumber(pStartLine),
        endLine: lineNumber(pEndLine - 1),
        sectionTitle,
        contentHash: parentHash,
      });

      // Split parent into child-sized sub-chunks
      const children = recursiveSplit(pText, cfg.childSize, cfg.overlap);
      for (const cText of children) {
        if (cText.trim().length === 0) continue;
        subChunks.push({
          parentIndex: parentIdx,
          content: cText,
          docPath,
          sectionTitle,
        });
      }
    }
  }

  return { parentChunks, subChunks };
}
