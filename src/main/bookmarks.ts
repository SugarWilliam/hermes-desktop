import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { app } from "electron";

// ── Types ──────────────────────────────────────────

export interface Bookmark {
  id: number;
  sessionId: string;
  messageId: number;
  note: string;
  createdAt: number;
}

// ── Bookmarks DB (separate SQLite file) ────────────

function getBookmarksDb(): Database.Database | null {
  try {
    const dir = join(app.getPath("userData"), "hermes-desktop");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, "bookmarks.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_session_message
        ON bookmarks (session_id, message_id);
    `);
    return db;
  } catch {
    return null;
  }
}

// ── CRUD ───────────────────────────────────────────

export function addBookmark(
  sessionId: string,
  messageId: number,
  note = "",
): Bookmark | null {
  const db = getBookmarksDb();
  if (!db) return null;
  try {
    const info = db
      .prepare(
        "INSERT OR IGNORE INTO bookmarks (session_id, message_id, note) VALUES (?, ?, ?)",
      )
      .run(sessionId, messageId, note);
    if (info.changes === 0) return null; // already exists
    const row = db
      .prepare("SELECT * FROM bookmarks WHERE id = ?")
      .get(info.lastInsertRowid) as {
      id: number;
      session_id: string;
      message_id: number;
      note: string;
      created_at: number;
    };
    return {
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id,
      note: row.note,
      createdAt: row.created_at,
    };
  } finally {
    db.close();
  }
}

export function removeBookmark(id: number): boolean {
  const db = getBookmarksDb();
  if (!db) return false;
  try {
    const info = db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
    return info.changes > 0;
  } finally {
    db.close();
  }
}

export function listBookmarks(): Bookmark[] {
  const db = getBookmarksDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT id, session_id, message_id, note, created_at
         FROM bookmarks
         ORDER BY created_at DESC`,
      )
      .all() as Array<{
      id: number;
      session_id: string;
      message_id: number;
      note: string;
      created_at: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      messageId: r.message_id,
      note: r.note,
      createdAt: r.created_at,
    }));
  } finally {
    db.close();
  }
}

export function updateBookmarkNote(id: number, note: string): boolean {
  const db = getBookmarksDb();
  if (!db) return false;
  try {
    const info = db
      .prepare("UPDATE bookmarks SET note = ? WHERE id = ?")
      .run(note, id);
    return info.changes > 0;
  } finally {
    db.close();
  }
}
