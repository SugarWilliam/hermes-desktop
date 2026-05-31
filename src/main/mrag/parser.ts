import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { KB_TEXT_EXTENSIONS, MAX_FILE_SIZE } from "./constants";

/**
 * MRAG Document Parser — reads text files from a KB document directory.
 * Pattern: synchronous, same as memory-index.ts.
 */

/** Result of reading a document file. */
export interface ParsedDoc {
  path: string;
  content: string;
  truncated: boolean;
}

/** List all supported text files in a directory. */
export function listDocs(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir).isDirectory()) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) continue;
    const ext = extname(entry).toLowerCase();
    if (KB_TEXT_EXTENSIONS.has(ext)) {
      results.push(fullPath);
    }
  }
  results.sort();
  return results;
}

/** Read a single document, with size limit enforcement. */
export function readDoc(filePath: string): { content: string; truncated: boolean; error?: string } {
  try {
    const st = statSync(filePath);
    if (st.size > MAX_FILE_SIZE) {
      const buf = readFileSync(filePath);
      const content = buf.toString("utf-8", 0, MAX_FILE_SIZE);
      return { content, truncated: true };
    }
    const content = readFileSync(filePath, "utf-8");
    return { content, truncated: false };
  } catch (err) {
    return { content: "", truncated: false, error: (err as Error).message };
  }
}

/** Batch-read all text files in a directory. */
export function readDocsFromDir(dir: string): ParsedDoc[] {
  const results: ParsedDoc[] = [];
  const files = listDocs(dir);
  for (const filePath of files) {
    const { content, truncated } = readDoc(filePath);
    if (content.length > 0) {
      results.push({ path: filePath, content, truncated });
    }
  }
  return results;
}

/** Get the relative filename (for display). */
export function relativeDocPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}
