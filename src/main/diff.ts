import { readFile, writeFile, mkdir } from "fs/promises";
import { join, resolve, basename } from "path";
import { existsSync } from "fs";
import { safeWriteFile } from "./utils";

/** A single hunk inside a unified diff. */
interface DiffHunk {
  /** The header line, e.g. "@@ -1,5 +1,6 @@" */
  header: string;
  /** Line-by-line content with +/-/space prefixes. */
  lines: string[];
  /** Zero-based start line in the original file (parsed from header). */
  oldStart: number;
  /** Number of lines affected in original (parsed from header). */
  oldCount: number;
  /** Zero-based start line in the new file (parsed from header). */
  newStart: number;
  /** Number of lines in result (parsed from header). */
  newCount: number;
}

/** One file's worth of diff patches. */
interface FileDiff {
  /** Relative path from workspace root. */
  filePath: string;
  hunks: DiffHunk[];
}

function parseHunkHeader(header: string): DiffHunk | null {
  // Match: @@ -oldStart[,oldCount] +newStart[,newCount] @@
  const m = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!m) return null;
  return {
    header,
    lines: [],
    oldStart: (parseInt(m[1], 10) || 1) - 1,
    oldCount: parseInt(m[2] || "1", 10),
    newStart: (parseInt(m[3], 10) || 1) - 1,
    newCount: parseInt(m[4] || "1", 10),
  };
}

/**
 * Parse a unified diff string into FileDiff entries.
 * Handles:
 *   --- a/path   +++ b/path   headers
 *   --- path     +++ path     (no a/b prefix)
 *   @@ -s,c +s,c @@ hunk headers
 */
export function parseUnifiedDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diff.split("\n");
  let current: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      // Extract the file path - strip any leading "a/" or "b/" prefix
      let path = line.slice(4).trim();
      // Remove "a/" or "b/" prefix common in git diffs
      path = path.replace(/^[ab]\//, "");
      // Handle tab after path (e.g., "--- a/file.ts\t2024-01-01")
      const tab = path.indexOf("\t");
      if (tab >= 0) path = path.slice(0, tab);

      if (line.startsWith("--- ")) {
        // Start of a new file
        current = { filePath: path, hunks: [] };
        currentHunk = null;
        files.push(current);
      }
      // "+++" lines are just metadata; file path already set by "---"
      continue;
    }

    if (line.startsWith("@@")) {
      if (!current) {
        // Diff without a file header — skip
        continue;
      }
      const hunk = parseHunkHeader(line);
      if (hunk) {
        current.hunks.push(hunk);
        currentHunk = hunk;
      }
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  // Filter out files that have no hunks (bare file headers)
  return files.filter((f) => f.hunks.length > 0);
}

/**
 * Apply a single hunk to an array of lines.
 * Returns the modified lines, or null if the hunk doesn't match.
 */
function applyHunk(originalLines: string[], hunk: DiffHunk): string[] | null {
  // Collect the expected original lines from the hunk
  const expectedLines: string[] = [];
  for (const hunkLine of hunk.lines) {
    if (hunkLine === "\\ No newline at end of file") continue;
    const prefix = hunkLine.charAt(0);
    if (prefix === " " || prefix === "-") {
      expectedLines.push(hunkLine.slice(1));
    }
  }

  // Try to find the hunk match location
  // Start at oldStart (zero-based), but allow some fuzziness
  let matchIdx = -1;
  const startSearch = Math.max(0, hunk.oldStart);
  const endSearch = Math.min(
    originalLines.length - expectedLines.length,
    startSearch + 50, // search window
  );

  for (let i = startSearch; i <= endSearch; i++) {
    let matched = true;
    for (let j = 0; j < expectedLines.length; j++) {
      const origLine = i + j < originalLines.length ? originalLines[i + j] : "";
      const expected = expectedLines[j];
      // Allow trailing whitespace differences
      if (origLine.trimEnd() !== expected.trimEnd()) {
        matched = false;
        break;
      }
    }
    if (matched) {
      matchIdx = i;
      break;
    }
  }

  if (matchIdx < 0) {
    // Try exact match at oldStart as fallback
    matchIdx = hunk.oldStart;
    // Verify at least first context line matches
    let firstContext = "";
    for (const hl of hunk.lines) {
      if (hl.startsWith(" ")) {
        firstContext = hl.slice(1);
        break;
      }
    }
    if (firstContext && matchIdx < originalLines.length) {
      if (originalLines[matchIdx].trimEnd() !== firstContext.trimEnd()) {
        return null; // can't match
      }
    }
  }

  // Build the new lines
  const newLines: string[] = [];

  for (const hunkLine of hunk.lines) {
    if (hunkLine === "\\ No newline at end of file") continue;
    const prefix = hunkLine.charAt(0);
    const rest = hunkLine.slice(1);

    if (prefix === " ") {
      // Context line
      newLines.push(rest);
    } else if (prefix === "-") {
      // Removed line — skip it
    } else if (prefix === "+") {
      // Added line
      newLines.push(rest);
    }
  }

  // Replace the affected region
  const result = [...originalLines];
  // RemovedLinesCount = number of " " and "-" lines in hunk
  const removedCount = hunk.lines.reduce((c, l) => {
    const p = l.charAt(0);
    return c + (p === " " || p === "-" ? 1 : 0);
  }, 0);

  result.splice(matchIdx, removedCount, ...newLines);
  return result;
}

/** Result of applying a diff. */
export interface ApplyDiffResult {
  /** Absolute paths of files that were modified. */
  files: string[];
  /** Absolute path to the backup directory (null if no files changed). */
  backupDir: string | null;
  errors: string[];
}

const BACKUP_DIR_NAME = ".hermes-patch-backups";

/** Create a timestamped backup of a file. */
async function backupFile(absPath: string, backupDir: string): Promise<void> {
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true });
  }
  const content = existsSync(absPath)
    ? await readFile(absPath, "utf-8")
    : "(new file)";
  const ts = Date.now();
  const name = basename(absPath);
  const backupPath = join(backupDir, `${ts}-${name}`);
  // simple copy
  await safeWriteFile(backupPath, content);
}

/**
 * Apply a unified diff to files in the workspace.
 * Creates timestamped backups before modifying any file.
 */
export async function applyUnifiedDiff(
  root: string,
  diff: string,
): Promise<ApplyDiffResult> {
  const absRoot = resolve(root);
  const parsed = parseUnifiedDiff(diff);
  const errors: string[] = [];
  const modifiedFiles: string[] = [];
  const timestamp = Date.now();
  const backupDir = join(absRoot, BACKUP_DIR_NAME, String(timestamp));

  for (const fd of parsed) {
    const absPath = resolve(absRoot, fd.filePath);

    // Security: ensure path is under root
    if (!absPath.startsWith(absRoot + "/") && absPath !== absRoot) {
      errors.push(`Skipped ${fd.filePath}: path is outside workspace root`);
      continue;
    }

    try {
      // Read original content
      let originalLines: string[];
      if (existsSync(absPath)) {
        const content = await readFile(absPath, "utf-8");
        originalLines = content.split("\n");
      } else {
        originalLines = [];
      }

      // Apply hunks sequentially
      let currentLines = originalLines;
      for (const hunk of fd.hunks) {
        const result = applyHunk(currentLines, hunk);
        if (result === null) {
          errors.push(
            `Failed to apply hunk ${hunk.header} in ${fd.filePath}: could not match context`,
          );
          break;
        }
        currentLines = result;
      }

      if (currentLines !== originalLines) {
        // Backup original first
        await backupFile(absPath, backupDir);
        // Write modified content
        const newContent = currentLines.join("\n");
        await writeFile(absPath, newContent, "utf-8");
        modifiedFiles.push(absPath);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error applying to ${fd.filePath}: ${msg}`);
    }
  }

  return {
    files: modifiedFiles,
    backupDir: modifiedFiles.length > 0 ? backupDir : null,
    errors,
  };
}
