import { existsSync } from "fs";
import { kbDbPath, openKbDb } from "./kb-manager";
import { SNIPPET_WINDOW, DEFAULT_TOP_K, MAX_TOP_K } from "./constants";
import type { SearchResult } from "./types";

/**
 * MRAG Retriever — FTS5 keyword search with snippet extraction.
 * Score is normalized to 0-1 for future hybrid blending with vector search.
 */

/** Sanitize user query for FTS5 MATCH syntax. */
function sanitizeQuery(query: string): string {
  // Strip FTS5 special characters that cause syntax errors
  const safe = query
    .replace(/[*"()^~:@]/g, " ")
    .trim();
  if (!safe) return "*";

  const words = safe.split(/\s+/);
  if (words.length === 0) return "*";

  // Wrap each word in quotes with prefix wildcard for partial matching
  return words
    .map((w) => `"${w}"*`)
    .join(" AND ");
}

/** Convert FTS5 rank (negative, larger = better) to normalized 0-1 score. */
function normalizeScore(rank: number, minRank: number, maxRank: number): number {
  if (minRank === maxRank) return 1;
  // FTS5 rank is typically negative; lower (more negative) = worse
  return Math.max(0, Math.min(1, (rank - minRank) / (maxRank - minRank)));
}

/** Search a single knowledge base. */
export function searchKB(
  key: string,
  query: string,
  topK = DEFAULT_TOP_K,
  profile?: string,
): SearchResult[] {
  const dbPath = kbDbPath(key, profile);
  if (!existsSync(dbPath)) return [];

  const sanitized = sanitizeQuery(query);
  const limit = Math.max(1, Math.min(topK, MAX_TOP_K));

  const db = openKbDb(key, profile);
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT
        pc.id AS id,
        pc.content AS parent_content,
        pc.doc_path AS doc_path,
        pc.section_title AS section_title,
        snippet(sub_chunks_fts, 0, '<mark>', '</mark>', '...', ${SNIPPET_WINDOW}) AS sub_snippet,
        rank
      FROM sub_chunks_fts
      JOIN parent_chunks pc ON sub_chunks_fts.parent_id = pc.id
      WHERE sub_chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(sanitized, limit) as Array<{
      id: number;
      parent_content: string;
      doc_path: string;
      section_title: string;
      sub_snippet: string;
      rank: number;
    }>;

    if (rows.length === 0) return [];

    // Compute normalization range
    const ranks = rows.map((r) => r.rank);
    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);

    return rows.map((row) => ({
      score: normalizeScore(row.rank, minRank, maxRank),
      parentContent: row.parent_content,
      subSnippet: row.sub_snippet,
      docPath: row.doc_path,
      sectionTitle: row.section_title,
      parentId: row.id,
    }));
  } catch {
    // FTS5 may throw on invalid query syntax
    return [];
  } finally {
    db.close();
  }
}

/** Search across all knowledge bases. */
export function searchAllKBs(
  query: string,
  topK = DEFAULT_TOP_K,
  profile?: string,
): Record<string, SearchResult[]> {
  const { readdirSync } = require("fs");
  const dir = (() => {
    const { join } = require("path");
    const { profileHome } = require("../utils");
    const d = join(profileHome(profile), "desktop", "mrag");
    return d;
  })();

  const results: Record<string, SearchResult[]> = {};

  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (!entry.endsWith(".db")) continue;
    const key = entry.replace(/\.db$/, "");
    const searchResults = searchKB(key, query, topK, profile);
    if (searchResults.length > 0) {
      results[key] = searchResults;
    }
  }

  return results;
}

/** Get the total number of indexed chunks for a KB. */
export function getKBChunkCount(key: string, profile?: string): number {
  const dbPath = kbDbPath(key, profile);
  if (!existsSync(dbPath)) return 0;

  const db = openKbDb(key, profile);
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM parent_chunks")
      .get() as { cnt: number };
    return row?.cnt ?? 0;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}
