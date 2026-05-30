/**
 * Parent directory of an absolute file path (Windows or POSIX).
 * Returns null when the path has no directory segment.
 */
export function parentDirectory(filePath: string): string | null {
  const trimmed = filePath.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*)[/\\][^/\\]+$/);
  if (!match || !match[1]) return null;
  return match[1];
}

function isAbsolutePath(filePath: string): boolean {
  return /^([a-zA-Z]:[\\/]|\/)/.test(filePath);
}

/** Join workspace-relative paths from the file tree with the bound root folder. */
export function resolvePathUnderRoot(
  filePath: string,
  root?: string | null,
): string {
  const trimmed = filePath.trim();
  if (!trimmed) return trimmed;
  if (isAbsolutePath(trimmed)) return trimmed;
  if (!root?.trim()) return trimmed;
  const sep = root.includes("\\") ? "\\" : "/";
  const base = root.replace(/[\\/]+$/, "");
  const rel = trimmed.replace(/^[\\/]+/, "");
  return `${base}${sep}${rel}`;
}
