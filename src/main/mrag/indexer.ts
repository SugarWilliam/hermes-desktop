import { kbDbPath, openKbDb, touchKB } from "./kb-manager";
import { readDocsFromDir } from "./parser";
import { chunkDocument, hashContent } from "./chunker";
import { MAX_FILES_PER_KB } from "./constants";
import type { IndexResult } from "./types";

/**
 * MRAG Indexer — builds and maintains FTS5 indexes for knowledge bases.
 * Supports full re-indexing and incremental (hash-based) updates.
 * Pattern follows memory-index.ts.
 */

/** Full re-index — clears all existing chunks and rebuilds from scratch. */
export function indexKB(
  key: string,
  docDir: string,
  profile?: string,
): IndexResult {
  const result: IndexResult = {
    indexed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const dbPath = kbDbPath(key, profile);
  const { existsSync } = require("fs");
  if (!existsSync(dbPath)) {
    result.errors.push(`KB "${key}" not found`);
    return result;
  }

  const docs = readDocsFromDir(docDir);
  if (docs.length === 0) {
    result.errors.push("No supported files found in directory");
    return result;
  }
  if (docs.length > MAX_FILES_PER_KB) {
    result.errors.push(
      `Too many files (${docs.length}). Maximum is ${MAX_FILES_PER_KB}.`,
    );
    return result;
  }

  const db = openKbDb(key, profile);
  try {
    // Transaction for atomic rebuild
    db.transaction(() => {
      // Clear existing data
      db.exec("DELETE FROM parent_chunks");
      db.exec("DELETE FROM sub_chunks_fts");
      db.exec("DELETE FROM doc_registry");

      const insertParent = db.prepare(`
        INSERT INTO parent_chunks (doc_path, content, start_line, end_line, section_title, content_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertSub = db.prepare(`
        INSERT INTO sub_chunks_fts (content, parent_id, doc_path, section_title)
        VALUES (?, ?, ?, ?)
      `);
      const insertRegistry = db.prepare(
        "INSERT OR REPLACE INTO doc_registry (path, content_hash) VALUES (?, ?)",
      );

      for (const doc of docs) {
        try {
          const fullHash = hashContent(doc.content);
          const { parentChunks, subChunks } = chunkDocument(
            doc.content,
            doc.path,
          );

          // Insert parent chunks and track their DB IDs
          const parentIds: number[] = [];
          for (const pc of parentChunks) {
            const info = insertParent.run(
              pc.docPath,
              pc.content,
              pc.startLine,
              pc.endLine,
              pc.sectionTitle,
              pc.contentHash,
            );
            parentIds.push(Number(info.lastInsertRowid));
          }

          // Insert sub-chunks linked to parent IDs
          for (const sc of subChunks) {
            const dbParentId = parentIds[sc.parentIndex];
            if (dbParentId != null) {
              insertSub.run(sc.content, dbParentId, sc.docPath, sc.sectionTitle);
            }
          }

          // Register document hash
          insertRegistry.run(doc.path, fullHash);
          result.indexed++;
        } catch (err) {
          result.errors.push(
            `${doc.path}: ${(err as Error).message}`,
          );
        }
      }
    })();

    touchKB(key, profile);
  } catch (err) {
    result.errors.push((err as Error).message);
  } finally {
    db.close();
  }

  return result;
}

/** Incremental re-index — only processes changed/added/removed files. */
export function incrementalIndexKB(
  key: string,
  docDir: string,
  profile?: string,
): IndexResult {
  const result: IndexResult = {
    indexed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const dbPath = kbDbPath(key, profile);
  const { existsSync } = require("fs");
  if (!existsSync(dbPath)) {
    result.errors.push(`KB "${key}" not found`);
    return result;
  }

  const docs = readDocsFromDir(docDir);
  if (docs.length > MAX_FILES_PER_KB) {
    result.errors.push(
      `Too many files (${docs.length}). Maximum is ${MAX_FILES_PER_KB}.`,
    );
    return result;
  }

  const db = openKbDb(key, profile);
  try {
    // Get current registry entries
    const registryRows = db
      .prepare("SELECT path, content_hash FROM doc_registry")
      .all() as Array<{ path: string; content_hash: string }>;
    const registryMap = new Map(
      registryRows.map((r) => [r.path, r.content_hash]),
    );

    // Build set of current file paths
    const currentPaths = new Set(docs.map((d) => d.path));

    db.transaction(() => {
      const deleteChunksForDoc = db.prepare(
        "DELETE FROM parent_chunks WHERE doc_path = ?",
      );
      const deleteSubForDoc = db.prepare(
        "DELETE FROM sub_chunks_fts WHERE doc_path = ?",
      );
      const deleteRegistry = db.prepare(
        "DELETE FROM doc_registry WHERE path = ?",
      );

      const insertParent = db.prepare(`
        INSERT INTO parent_chunks (doc_path, content, start_line, end_line, section_title, content_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertSub = db.prepare(`
        INSERT INTO sub_chunks_fts (content, parent_id, doc_path, section_title)
        VALUES (?, ?, ?, ?)
      `);
      const insertRegistry = db.prepare(
        "INSERT OR REPLACE INTO doc_registry (path, content_hash) VALUES (?, ?)",
      );

      // Process new and changed files
      for (const doc of docs) {
        try {
          const fullHash = hashContent(doc.content);
          const existingHash = registryMap.get(doc.path);

          if (existingHash === fullHash) {
            result.skipped++;
            continue;
          }

          // Remove old entries
          deleteSubForDoc.run(doc.path);
          deleteChunksForDoc.run(doc.path);

          // Re-chunk and index
          const { parentChunks, subChunks } = chunkDocument(
            doc.content,
            doc.path,
          );

          const parentIds: number[] = [];
          for (const pc of parentChunks) {
            const info = insertParent.run(
              pc.docPath,
              pc.content,
              pc.startLine,
              pc.endLine,
              pc.sectionTitle,
              pc.contentHash,
            );
            parentIds.push(Number(info.lastInsertRowid));
          }

          for (const sc of subChunks) {
            const dbParentId = parentIds[sc.parentIndex];
            if (dbParentId != null) {
              insertSub.run(sc.content, dbParentId, sc.docPath, sc.sectionTitle);
            }
          }

          insertRegistry.run(doc.path, fullHash);
          if (existingHash) {
            result.updated++;
          } else {
            result.indexed++;
          }
        } catch (err) {
          result.errors.push(
            `${doc.path}: ${(err as Error).message}`,
          );
        }
      }

      // Remove deleted files
      for (const [regPath] of registryMap) {
        if (!currentPaths.has(regPath)) {
          deleteSubForDoc.run(regPath);
          deleteChunksForDoc.run(regPath);
          deleteRegistry.run(regPath);
        }
      }
    })();

    if (result.indexed > 0 || result.updated > 0) {
      touchKB(key, profile);
    }
  } catch (err) {
    result.errors.push((err as Error).message);
  } finally {
    db.close();
  }

  return result;
}

/** Add a single document to the KB index. */
export function addDocToKB(
  key: string,
  filePath: string,
  profile?: string,
): { success: boolean; parentCount: number; error?: string } {
  const dbPath = kbDbPath(key, profile);
  const { existsSync, readFileSync } = require("fs");
  if (!existsSync(dbPath)) {
    return { success: false, parentCount: 0, error: `KB "${key}" not found` };
  }
  if (!existsSync(filePath)) {
    return { success: false, parentCount: 0, error: "File not found" };
  }

  const db = openKbDb(key, profile);
  try {
    const content = readFileSync(filePath, "utf-8");
    const fullHash = hashContent(content);

    // Remove old entries for this document
    db.prepare("DELETE FROM sub_chunks_fts WHERE doc_path = ?").run(filePath);
    db.prepare("DELETE FROM parent_chunks WHERE doc_path = ?").run(filePath);

    const { parentChunks, subChunks } = chunkDocument(content, filePath);

    const insertParent = db.prepare(`
      INSERT INTO parent_chunks (doc_path, content, start_line, end_line, section_title, content_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertSub = db.prepare(
      "INSERT INTO sub_chunks_fts (content, parent_id, doc_path, section_title) VALUES (?, ?, ?, ?)",
    );

    const parentIds: number[] = [];
    for (const pc of parentChunks) {
      const info = insertParent.run(
        pc.docPath,
        pc.content,
        pc.startLine,
        pc.endLine,
        pc.sectionTitle,
        pc.contentHash,
      );
      parentIds.push(Number(info.lastInsertRowid));
    }

    for (const sc of subChunks) {
      const dbParentId = parentIds[sc.parentIndex];
      if (dbParentId != null) {
        insertSub.run(sc.content, dbParentId, sc.docPath, sc.sectionTitle);
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO doc_registry (path, content_hash) VALUES (?, ?)",
    ).run(filePath, fullHash);

    touchKB(key, profile);
    return { success: true, parentCount: parentChunks.length };
  } catch (err) {
    return { success: false, parentCount: 0, error: (err as Error).message };
  } finally {
    db.close();
  }
}

/** Remove a single document from the KB index. */
export function removeDocFromKB(
  key: string,
  docPath: string,
  profile?: string,
): void {
  const dbPath = kbDbPath(key, profile);
  const { existsSync } = require("fs");
  if (!existsSync(dbPath)) return;

  const db = openKbDb(key, profile);
  try {
    db.transaction(() => {
      db.prepare("DELETE FROM sub_chunks_fts WHERE doc_path = ?").run(docPath);
      db.prepare("DELETE FROM parent_chunks WHERE doc_path = ?").run(docPath);
      db.prepare("DELETE FROM doc_registry WHERE path = ?").run(docPath);
    })();
    touchKB(key, profile);
  } finally {
    db.close();
  }
}
