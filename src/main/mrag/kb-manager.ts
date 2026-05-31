import { existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome } from "../utils";
import type { KBInfo } from "./types";

/**
 * MRAG Knowledge Base Manager — CRUD operations for knowledge bases.
 * Each KB is a SQLite .db file stored under `<profile>/desktop/mrag/`.
 */

/** Resolve the KB storage directory for a profile. */
function kbDir(profile?: string): string {
  const dir = join(profileHome(profile), "desktop", "mrag");
  if (!existsSync(dir)) {
    const { mkdirSync } = require("fs");
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* best-effort */
    }
  }
  return dir;
}

/** Resolve the database path for a specific KB. */
function kbDbPath(key: string, profile?: string): string {
  return join(kbDir(profile), `${key}.db`);
}

/**
 * Open (or create) a KB database and ensure schema exists.
 * Caller should close the db when done.
 */
function openKbDb(key: string, profile?: string): Database.Database {
  const dbPath = kbDbPath(key, profile);
  const dbDir = kbDir(profile);
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
    CREATE TABLE IF NOT EXISTS kb_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parent_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_path TEXT NOT NULL,
      content TEXT NOT NULL,
      start_line INTEGER NOT NULL DEFAULT 0,
      end_line INTEGER NOT NULL DEFAULT 0,
      section_title TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );
    CREATE TABLE IF NOT EXISTS doc_registry (
      path TEXT PRIMARY KEY NOT NULL,
      content_hash TEXT NOT NULL,
      indexed_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );
  `);
  // FTS5 virtual table — ensure it exists (must be separate from transaction)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS sub_chunks_fts USING fts5(
      content,
      parent_id UNINDEXED,
      doc_path UNINDEXED,
      section_title UNINDEXED,
      tokenize='porter unicode61'
    );
  `);
  return db;
}

/** Generate a URL-safe key from a name. */
function nameToKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ── Public API ────────────────────────────────────────

/** Create a new knowledge base. */
export function createKB(
  name: string,
  profile?: string,
): { success: boolean; error?: string; key?: string } {
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Name is required" };
  }
  const key = nameToKey(name);
  if (!key) {
    return { success: false, error: "Invalid KB name" };
  }
  const dbPath = kbDbPath(key, profile);
  if (existsSync(dbPath)) {
    return { success: false, error: `KB "${key}" already exists` };
  }

  const db = openKbDb(key, profile);
  try {
    const now = Math.floor(Date.now() / 1000);
    const insert = db.prepare(
      "INSERT OR REPLACE INTO kb_meta (key, value) VALUES (?, ?)",
    );
    db.transaction(() => {
      insert.run("name", name.trim());
      insert.run("key", key);
      insert.run("created_at", String(now));
      insert.run("updated_at", String(now));
    })();
    return { success: true, key };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  } finally {
    db.close();
  }
}

/** List all knowledge bases for a profile. */
export function listKBs(profile?: string): KBInfo[] {
  const dir = kbDir(profile);
  if (!existsSync(dir)) return [];

  const results: KBInfo[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (!entry.endsWith(".db")) continue;
    const key = entry.replace(/\.db$/, "");
    const info = getKBInfo(key, profile);
    if (info) results.push(info);
  }
  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return results;
}

/** Get metadata for a single KB. */
export function getKBInfo(key: string, profile?: string): KBInfo | null {
  const dbPath = kbDbPath(key, profile);
  if (!existsSync(dbPath)) return null;

  const db = openKbDb(key, profile);
  try {
    const metaRows = db
      .prepare("SELECT key, value FROM kb_meta")
      .all() as Array<{ key: string; value: string }>;
    const meta: Record<string, string> = {};
    for (const row of metaRows) {
      meta[row.key] = row.value;
    }
    const docCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM doc_registry").get() as {
        cnt: number;
      }
    ).cnt;
    const chunkCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM parent_chunks").get() as {
        cnt: number;
      }
    ).cnt;
    return {
      key: meta.key || key,
      name: meta.name || key,
      path: dbPath,
      docCount,
      chunkCount,
      createdAt: Number(meta.created_at) || 0,
      updatedAt: Number(meta.updated_at) || 0,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Update KB metadata timestamp. */
function touchKB(key: string, profile?: string): void {
  const db = openKbDb(key, profile);
  try {
    db.prepare(
      "INSERT OR REPLACE INTO kb_meta (key, value) VALUES ('updated_at', ?)",
    ).run(String(Math.floor(Date.now() / 1000)));
  } finally {
    db.close();
  }
}

/** Rename a knowledge base. */
export function renameKB(
  key: string,
  newName: string,
  profile?: string,
): { success: boolean; error?: string } {
  if (!newName || newName.trim().length === 0) {
    return { success: false, error: "Name is required" };
  }
  const dbPath = kbDbPath(key, profile);
  if (!existsSync(dbPath)) {
    return { success: false, error: `KB "${key}" not found` };
  }
  const db = openKbDb(key, profile);
  try {
    db.prepare(
      "INSERT OR REPLACE INTO kb_meta (key, value) VALUES ('name', ?)",
    ).run(newName.trim());
    touchKB(key, profile);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  } finally {
    db.close();
  }
}

/** Delete a knowledge base and its database file. */
export function deleteKB(
  key: string,
  profile?: string,
): { success: boolean; error?: string } {
  const dbPath = kbDbPath(key, profile);
  if (!existsSync(dbPath)) {
    return { success: false, error: `KB "${key}" not found` };
  }
  try {
    unlinkSync(dbPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Exported for use by indexer.ts. */
export { kbDbPath, openKbDb, touchKB, kbDir };
