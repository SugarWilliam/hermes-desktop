import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome } from "./utils";

/**
 * Memory FTS index — maintains a full-text-search index of all memory
 * entries so the renderer can offer searchable memory browsing.
 *
 * Schema: shadow table `memories_fts` in a dedicated `memory-index.db`
 * under `<profile>/desktop/`. This avoids polluting the agent's own
 * `state.db`.
 */

const ENTRY_DELIMITER = "\n§\n";

export interface MemorySearchResult {
  index: number; // 0-based entry index in the MEMORY.md file
  content: string;
  snippet: string; // highlighted excerpt, ~100 chars
}

function indexDbPath(profile?: string): string {
  const desktopDir = join(profileHome(profile), "desktop");
  return join(desktopDir, "memory-index.db");
}

/**
 * Open (or create) the memory index database and ensure the FTS table
 * exists. The caller should close the db when done.
 */
function openIndexDb(profile?: string): Database.Database {
  const dbPath = indexDbPath(profile);
  const dbDir = join(profileHome(profile), "desktop");
  if (!existsSync(dbDir)) {
    const { mkdirSync } = require("fs");
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      entry_index,
      content,
      tokenize='porter unicode61'
    );
  `);
  return db;
}

/**
 * Index all memory entries from the given content string.
 * Replaces the existing FTS index for the profile atomically.
 */
export function indexMemory(content: string, profile?: string): void {
  const entries = content
    .split(ENTRY_DELIMITER)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const db = openIndexDb(profile);
  try {
    const insert = db.prepare(
      "INSERT INTO memories_fts(rowid, entry_index, content) VALUES(?, ?, ?)",
    );
    db.transaction(() => {
      // Clear existing index
      db.exec("DELETE FROM memories_fts");
      for (let i = 0; i < entries.length; i++) {
        insert.run(i + 1, i, entries[i]);
      }
    })();
  } finally {
    db.close();
  }
}

/**
 * Full-text search memory entries. Returns ranked results with
 * highlighted snippets showing match context.
 */
export function searchMemory(
  query: string,
  limit = 10,
  profile?: string,
): MemorySearchResult[] {
  const dbPath = indexDbPath(profile);
  if (!existsSync(dbPath)) return [];

  const db = openIndexDb(profile);
  try {
    // Use FTS5 `snippet()` function to get highlighted match context
    const stmt = db.prepare(`
      SELECT
        entry_index,
        content,
        snippet(memories_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
      FROM memories_fts
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as Array<{
      entry_index: number;
      content: string;
      snippet: string;
    }>;

    return rows.map((row) => ({
      index: row.entry_index,
      content: row.content,
      snippet: row.snippet,
    }));
  } catch {
    // FTS5 will throw on invalid query syntax — return empty
    return [];
  } finally {
    db.close();
  }
}

/**
 * Count the number of indexed memory entries for a profile.
 */
export function memoryIndexCount(profile?: string): number {
  const dbPath = indexDbPath(profile);
  if (!existsSync(dbPath)) return 0;

  const db = openIndexDb(profile);
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM memories_fts")
      .get() as { count: number };
    return row?.count ?? 0;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

/**
 * Delete the memory index database for a profile (e.g., on profile deletion).
 */
export function deleteMemoryIndex(profile?: string): void {
  const dbPath = indexDbPath(profile);
  if (!existsSync(dbPath)) return;
  try {
    const { unlinkSync } = require("fs");
    unlinkSync(dbPath);
  } catch {
    /* best-effort */
  }
}
