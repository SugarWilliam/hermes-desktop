import { execFile } from "child_process";
import { promisify } from "util";
import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, resolve, sep, basename, extname } from "path";
import { dialog, BrowserWindow } from "electron";

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".sh",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".cxx",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".toml",
  ".ini",
  ".env",
  ".cmake",
  ".gradle",
]);

const MAX_READ_BYTES = 512 * 1024;

export interface WorkspaceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

function assertUnderRoot(root: string, target: string): string {
  const absRoot = resolve(root);
  const absTarget = resolve(target);
  const prefix = absRoot.endsWith(sep) ? absRoot : absRoot + sep;
  if (absTarget !== absRoot && !absTarget.startsWith(prefix)) {
    throw new Error("Path is outside the workspace root");
  }
  return absTarget;
}

/** List `dirPath` (absolute, must be under `root`) or `root` when omitted. */
export async function listWorkspaceDir(
  root: string,
  dirPath?: string,
): Promise<WorkspaceEntry[]> {
  const absRoot = assertUnderRoot(root, root);
  const dir = dirPath ? assertUnderRoot(absRoot, resolve(dirPath)) : absRoot;
  const entries = await readdir(dir, { withFileTypes: true });
  const out: WorkspaceEntry[] = [];
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    out.push({
      name: ent.name,
      path: full,
      isDirectory: ent.isDirectory(),
    });
  }
  out.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function readWorkspaceTextFile(
  root: string,
  filePath: string,
): Promise<{ content: string; truncated: boolean }> {
  const absRoot = assertUnderRoot(root, root);
  const absFile = assertUnderRoot(absRoot, filePath);
  const st = await stat(absFile);
  if (!st.isFile()) throw new Error("Not a file");
  const buf = await readFile(absFile);
  const truncated = buf.length > MAX_READ_BYTES;
  const slice = truncated ? buf.subarray(0, MAX_READ_BYTES) : buf;
  return { content: slice.toString("utf-8"), truncated };
}

export async function writeWorkspaceTextFile(
  root: string,
  filePath: string,
  content: string,
): Promise<void> {
  const absRoot = assertUnderRoot(root, root);
  const absFile = assertUnderRoot(absRoot, filePath);
  if (!TEXT_EXTENSIONS.has(extname(absFile).toLowerCase())) {
    throw new Error("Only text/markdown/code files can be edited");
  }
  await writeFile(absFile, content, "utf-8");
}

export function formatFileContextQuote(
  filePath: string,
  content: string,
  startLine?: number,
  endLine?: number,
): string {
  const name = basename(filePath);
  const lang = extname(name).slice(1) || "text";
  if (startLine != null && endLine != null) {
    return (
      `Context from \`${name}\` (lines ${startLine}-${endLine}):\n\n` +
      "```" +
      `${lang}\n${content}\n` +
      "```"
    );
  }
  return (
    `Context from file \`${filePath}\`:\n\n` + "```" + `${lang}\n${content}\n` + "```"
  );
}

export async function pickWorkspaceFiles(
  win: BrowserWindow | null,
): Promise<string[]> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        properties: ["openFile", "multiSelections"],
      })
    : await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
      });
  if (result.canceled) return [];
  return result.filePaths;
}

export function isLikelyTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

const execFileAsync = promisify(execFile);

export type WorkspaceGitStatus = "modified" | "added" | "deleted" | "untracked";

/** Porcelain paths → absolute path under `root`. Empty map if not a git repo. */
export async function getWorkspaceGitStatus(
  root: string,
): Promise<Record<string, WorkspaceGitStatus>> {
  const absRoot = resolve(root);
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", absRoot, "status", "--porcelain", "-u"],
      { timeout: 8000, maxBuffer: 2 * 1024 * 1024 },
    );
    const out: Record<string, WorkspaceGitStatus> = {};
    for (const line of stdout.split("\n")) {
      if (line.length < 4) continue;
      const code = line.slice(0, 2);
      let rel = line.slice(3).trim();
      const arrow = rel.indexOf(" -> ");
      if (arrow >= 0) rel = rel.slice(arrow + 4).trim();
      if (!rel) continue;
      const full = resolve(absRoot, rel);
      let status: WorkspaceGitStatus = "modified";
      if (code.includes("?")) status = "untracked";
      else if (code.includes("A")) status = "added";
      else if (code.includes("D")) status = "deleted";
      else if (code.includes("M")) status = "modified";
      out[full] = status;
    }
    return out;
  } catch {
    return {};
  }
}

// ── Git Operations ─────────────────────────────────────

const GIT_TIMEOUT = 15000;

export async function gitCommit(
  root: string,
  message: string,
  files?: string[],
): Promise<{ success: boolean; error?: string }> {
  const absRoot = resolve(root);
  try {
    if (files && files.length > 0) {
      const relFiles = files.map((f) => {
        const abs = assertUnderRoot(absRoot, f);
        return abs.slice(absRoot.length + 1);
      });
      await execFileAsync("git", ["-C", absRoot, "add", "--", ...relFiles], {
        timeout: GIT_TIMEOUT,
      });
    } else {
      await execFileAsync("git", ["-C", absRoot, "add", "-A"], {
        timeout: GIT_TIMEOUT,
      });
    }
    await execFileAsync("git", ["-C", absRoot, "commit", "-m", message], {
      timeout: GIT_TIMEOUT,
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function gitPush(
  root: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync("git", ["-C", resolve(root), "push"], {
      timeout: 30000,
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function gitPull(
  root: string,
): Promise<{ success: boolean; error?: string; output?: string }> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", resolve(root), "pull"],
      { timeout: 30000 },
    );
    return { success: true, output: stdout.trim() };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function gitBranches(
  root: string,
): Promise<{ current: string; branches: string[] }> {
  const absRoot = resolve(root);
  try {
    const { stdout: currentOut } = await execFileAsync(
      "git",
      ["-C", absRoot, "rev-parse", "--abbrev-ref", "HEAD"],
      { timeout: GIT_TIMEOUT },
    );
    const current = currentOut.trim();
    const { stdout } = await execFileAsync(
      "git",
      ["-C", absRoot, "branch", "--list", "--format=%(refname:short)"],
      { timeout: GIT_TIMEOUT },
    );
    const branches = stdout
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    return { current, branches };
  } catch {
    return { current: "unknown", branches: [] };
  }
}

export async function gitSwitchBranch(
  root: string,
  branch: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync(
      "git",
      ["-C", resolve(root), "checkout", branch],
      { timeout: GIT_TIMEOUT },
    );
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function gitDiff(
  root: string,
  file?: string,
): Promise<string> {
  const absRoot = resolve(root);
  const args = ["-C", absRoot, "diff"];
  if (file) {
    assertUnderRoot(absRoot, resolve(absRoot, file));
    args.push("--", file);
  }
  try {
    const { stdout } = await execFileAsync("git", args, {
      timeout: GIT_TIMEOUT,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return "";
  }
}
