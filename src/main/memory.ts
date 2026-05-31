import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome, safeWriteFile } from "./utils";
import { indexMemory } from "./memory-index";

const ENTRY_DELIMITER = "\n§\n";
const MEMORY_CHAR_LIMIT = 2200;
const USER_CHAR_LIMIT = 1375;

export interface MemoryEntry {
  index: number;
  content: string;
}

export interface MemoryInfo {
  memory: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    entries: MemoryEntry[];
    charCount: number;
    charLimit: number;
  };
  user: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    charCount: number;
    charLimit: number;
  };
  stats: { totalSessions: number; totalMessages: number };
}


// ── Memory Categorization ───────────────────────────

/** Parsed memory category info. */
export interface MemoryCategory {
  name: string;
  displayName: string;
  count: number;
}

/** Extract [category: xxx] tag from a memory entry. */
function extractCategory(content: string): string {
  const match = content.match(/^\[category:\s*([^\]]+)\]/m);
  return match ? match[1].trim().toLowerCase() : "uncategorized";
}

/** Extract [priority: xxx] tag (high/medium/low). */
function extractPriority(content: string): string {
  const match = content.match(/^\[priority:\s*([^\]]+)\]/m);
  return match ? match[1].trim().toLowerCase() : "low";
}

/** List all memory categories with counts. */
export function getMemoryCategories(profile?: string): MemoryCategory[] {
  const mem = readMemory(profile);
  const entries = mem.memory.entries;
  if (entries.length === 0) return [];
  
  const categoryMap = new Map<string, number>();
  for (const entry of entries) {
    const cat = extractCategory(entry.content);
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  }
  
  const displayNames: Record<string, string> = {
    "session-summary": "Session Summaries",
    "project-context": "Project Context",
    "user-preference": "User Preferences",
    "learned-knowledge": "Learned Knowledge",
    "code-pattern": "Code Patterns",
    "decision-log": "Decision Log",
    "uncategorized": "Uncategorized",
  };
  
  return Array.from(categoryMap.entries()).map(([name, count]) => ({
    name,
    displayName: displayNames[name] || name,
    count,
  }));
}

/** Get memory entries filtered by category. */
export function getMemoryByCategory(category: string, profile?: string): MemoryEntry[] {
  const mem = readMemory(profile);
  if (category === "all") return mem.memory.entries;
  return mem.memory.entries.filter(
    (e) => extractCategory(e.content) === category
  );
}

/** Get high-priority memory entries for context injection. */
export function getHighPriorityMemories(profile?: string): string[] {
  const mem = readMemory(profile);
  return mem.memory.entries
    .filter((e) => extractPriority(e.content) === "high")
    .map((e) => e.content);
}

function memoryPath(profile?: string): string {
  return join(profileHome(profile), "memories", "MEMORY.md");
}

function userPath(profile?: string): string {
  return join(profileHome(profile), "memories", "USER.md");
}

function readFileSafe(filePath: string): {
  content: string;
  exists: boolean;
  lastModified: number | null;
} {
  if (!existsSync(filePath)) {
    return { content: "", exists: false, lastModified: null };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const stat = statSync(filePath);
    return {
      content,
      exists: true,
      lastModified: Math.floor(stat.mtimeMs / 1000),
    };
  } catch {
    return { content: "", exists: false, lastModified: null };
  }
}

function parseMemoryEntries(content: string): MemoryEntry[] {
  if (!content.trim()) return [];
  return content
    .split(ENTRY_DELIMITER)
    .map((entry, index) => ({ index, content: entry.trim() }))
    .filter((e) => e.content.length > 0);
}

function serializeEntries(entries: MemoryEntry[]): string {
  return entries.map((e) => e.content).join(ENTRY_DELIMITER);
}

// Use shared safeWriteFile from utils
const writeFileSafe = safeWriteFile;

function getSessionStats(profile?: string): {
  totalSessions: number;
  totalMessages: number;
} {
  const home = profileHome(profile);
  const dbPath = join(home, "state.db");
  if (!existsSync(dbPath)) return { totalSessions: 0, totalMessages: 0 };

  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const sessionRow = db
        .prepare("SELECT COUNT(*) as count FROM sessions")
        .get() as { count: number } | undefined;
      const messageRow = db
        .prepare("SELECT COUNT(*) as count FROM messages")
        .get() as { count: number } | undefined;
      return {
        totalSessions: sessionRow?.count ?? 0,
        totalMessages: messageRow?.count ?? 0,
      };
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[memory] getSessionStats failed:", err);
    return { totalSessions: 0, totalMessages: 0 };
  }
}

// ── Read ────────────────────────────────────────────

export function readMemory(profile?: string): MemoryInfo {
  const memFile = readFileSafe(memoryPath(profile));
  const userFile = readFileSafe(userPath(profile));

  // Backfill FTS index on read (lazy, idempotent)
  if (memFile.content) {
    try {
      indexMemory(memFile.content, profile);
    } catch {
      /* non-critical */
    }
  }

  return {
    memory: {
      ...memFile,
      entries: parseMemoryEntries(memFile.content),
      charCount: memFile.content.length,
      charLimit: MEMORY_CHAR_LIMIT,
    },
    user: {
      ...userFile,
      charCount: userFile.content.length,
      charLimit: USER_CHAR_LIMIT,
    },
    stats: getSessionStats(profile),
  };
}

// ── Write operations ────────────────────────────────

export function addMemoryEntry(
  content: string,
  profile?: string,
): { success: boolean; error?: string } {
  const filePath = memoryPath(profile);
  const existing = readFileSafe(filePath);
  const entries = parseMemoryEntries(existing.content);
  const newContent = serializeEntries([
    ...entries,
    { index: entries.length, content: content.trim() },
  ]);

  if (newContent.length > MEMORY_CHAR_LIMIT) {
    return {
      success: false,
      error: `Would exceed memory limit (${newContent.length}/${MEMORY_CHAR_LIMIT} chars)`,
    };
  }

  writeFileSafe(filePath, newContent);
  try {
    indexMemory(newContent, profile);
  } catch {
    /* non-critical */
  }
  return { success: true };
}

export function updateMemoryEntry(
  index: number,
  content: string,
  profile?: string,
): { success: boolean; error?: string } {
  const filePath = memoryPath(profile);
  const existing = readFileSafe(filePath);
  const entries = parseMemoryEntries(existing.content);

  if (index < 0 || index >= entries.length) {
    return { success: false, error: "Entry not found" };
  }

  entries[index] = { ...entries[index], content: content.trim() };
  const newContent = serializeEntries(entries);

  if (newContent.length > MEMORY_CHAR_LIMIT) {
    return {
      success: false,
      error: `Would exceed memory limit (${newContent.length}/${MEMORY_CHAR_LIMIT} chars)`,
    };
  }

  writeFileSafe(filePath, newContent);
  try {
    indexMemory(newContent, profile);
  } catch {
    /* non-critical */
  }
  return { success: true };
}

export function removeMemoryEntry(index: number, profile?: string): boolean {
  const filePath = memoryPath(profile);
  const existing = readFileSafe(filePath);
  const entries = parseMemoryEntries(existing.content);

  if (index < 0 || index >= entries.length) return false;

  entries.splice(index, 1);
  const newContent = serializeEntries(entries);
  writeFileSafe(filePath, newContent);
  try {
    indexMemory(newContent, profile);
  } catch {
    /* non-critical */
  }
  return true;
}

export function writeUserProfile(
  content: string,
  profile?: string,
): { success: boolean; error?: string } {
  if (content.length > USER_CHAR_LIMIT) {
    return {
      success: false,
      error: `Exceeds limit (${content.length}/${USER_CHAR_LIMIT} chars)`,
    };
  }
  writeFileSafe(userPath(profile), content);
  return { success: true };
}
