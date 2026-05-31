/**
 * MRAG (Multi-modal RAG) — barrel exports.
 * Provides KB management, indexing, retrieval, and agent context injection.
 */

// Types
export type {
  KBInfo,
  ParentChunk,
  ParentChunkInput,
  SubChunkInput,
  SearchResult,
  ChunkingConfig,
  IndexResult,
} from "./types";

// KB Manager
export {
  createKB,
  listKBs,
  getKBInfo,
  renameKB,
  deleteKB,
} from "./kb-manager";

// Parser
export { listDocs, readDoc, readDocsFromDir, relativeDocPath } from "./parser";
export type { ParsedDoc } from "./parser";

// Chunker
export { chunkDocument, hashContent, extractSectionTitle } from "./chunker";

// Indexer
export {
  indexKB,
  incrementalIndexKB,
  addDocToKB,
  removeDocFromKB,
} from "./indexer";

// Retriever
export { searchKB, searchAllKBs, getKBChunkCount } from "./retriever";

// ── Agent Context Injection ──────────────────────────

import { existsSync, statSync } from "fs";
import { join } from "path";
import { listKBs } from "./kb-manager";
import { searchKB } from "./retriever";
import { DEFAULT_TOP_K } from "./constants";

/**
 * Build a system message with relevant knowledge base excerpts
 * for the user's query. Follows the same pattern as
 * `getApplicableRulesPrompt()` in rules.ts.
 *
 * @param query The user's latest message text
 * @param contextFolder Optional workspace context folder for workspace-local KBs
 * @param topK Number of results per KB (default 5)
 * @param profile Optional profile name
 * @returns A markdown string for a system message, or null if no results
 */
export function getApplicableMragContext(
  query: string,
  contextFolder?: string,
  topK = DEFAULT_TOP_K,
  profile?: string,
): string | null {
  if (!query || query.trim().length === 0) return null;

  // Collect results from all KBs
  let allResults: Record<string, ReturnType<typeof searchKB>> = {};
  let kbNames: Record<string, string> = {};

  // Global KBs (profile-level)
  const globalKBs = listKBs(profile);
  for (const kb of globalKBs) {
    kbNames[kb.key] = kb.name;
    const results = searchKB(kb.key, query, topK, profile);
    if (results.length > 0) {
      allResults[kb.key] = results;
    }
  }

  // Workspace-local KBs (from context folder's mrag/ or .mrag/)
  if (contextFolder) {
    const workspaceMragDirs = [join(contextFolder, "mrag"), join(contextFolder, ".mrag")];
    for (const mragDir of workspaceMragDirs) {
      if (existsSync(mragDir) && statSync(mragDir).isDirectory()) {
        // Workspace mrag/ directory exists — indexed externally via createKB + indexKB
        break;
      }
    }
  }

  const totalResults = Object.values(allResults).flat().length;
  if (totalResults === 0) return null;

  // Build formatted context
  const parts: string[] = [];
  parts.push("## Knowledge Base Context");
  parts.push("");
  parts.push(
    `The following excerpts were retrieved from knowledge bases for the query "${query.slice(0, 100)}":`,
  );
  parts.push("");

  for (const [kbKey, results] of Object.entries(allResults)) {
    const kbName = kbNames[kbKey] || kbKey;
    parts.push(`### KB: ${kbName}`);

    for (const r of results) {
      const docName = r.docPath.split("/").pop() || r.docPath;
      const sectionLabel = r.sectionTitle
        ? ` (Section: ${r.sectionTitle})`
        : "";
      parts.push(`**${docName}**${sectionLabel} _(score: ${r.score.toFixed(2)})_`);
      parts.push("");
      if (r.subSnippet && r.subSnippet !== r.parentContent) {
        parts.push(`> ${r.subSnippet}`);
        parts.push("");
      }
      if (r.parentContent) {
        // Trim very long parent content to ~1500 chars
        const trimmed =
          r.parentContent.length > 1500
            ? r.parentContent.slice(0, 1500) + "..."
            : r.parentContent;
        parts.push("```");
        parts.push(trimmed);
        parts.push("```");
        parts.push("");
      }
    }
  }

  parts.push(
    "Use these excerpts to inform your responses. Cite the document name and section when referencing specific knowledge base content.",
  );

  return parts.join("\n").trim();
}
