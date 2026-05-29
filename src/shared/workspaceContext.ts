const MAX_CONTEXT_CHARS = 8000;

function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || filePath;
}

function extname(filePath: string): string {
  const m = /\.[^./\\]+$/.exec(filePath);
  return m ? m[0] : "";
}

function languageFromPath(filePath: string): string {
  const ext = extname(filePath).slice(1).toLowerCase();
  return ext || "text";
}

/** Compact @-reference for UI (input + chat bubbles), Cursor/Qoder style. */
export function formatWorkspaceFileReference(filePath: string): string {
  return `@${basename(filePath)}`;
}

/** Compact folder reference — includes absolute path for reliable resolution. */
export function formatWorkspaceFolderReference(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, "/");
  return `@folder:${normalized}`;
}

/** Compact selection reference — content stays in the editor, not in chat. */
export function formatWorkspaceSelectionReference(
  filePath: string | null,
): string {
  if (!filePath) return "@selection";
  return `@${basename(filePath)} (selection)`;
}

/**
 * If pasted/inserted text is a legacy full workspace block, extract a
 * one-line reference so chat does not render huge code fences.
 */
export function extractWorkspaceReferenceFromBlock(text: string): string | null {
  const trimmed = text.trim();
  const fileCtx = trimmed.match(
    /^Context from (?:file `([^`]+)`|`([^`]+)`)[^\n]*:/i,
  );
  if (fileCtx) {
    return formatWorkspaceFileReference(fileCtx[1] || fileCtx[2] || "");
  }
  const snippet = trimmed.match(/^Selected snippet from `([^`]+)`/i);
  if (snippet) {
    return formatWorkspaceSelectionReference(snippet[1]);
  }
  const folder = trimmed.match(/^Please scope work to this workspace folder:/i);
  if (folder) {
    const path = trimmed.match(/```\n?([^`]+)\n?```/);
    if (path) return formatWorkspaceFolderReference(path[1].trim());
  }
  return null;
}

/** Markdown/code block for a workspace file (agent payload — not shown in UI). */
export function formatWorkspaceFileBlock(
  filePath: string,
  content: string,
  opts?: { truncated?: boolean; startLine?: number; endLine?: number },
): string {
  const name = basename(filePath);
  const lang = languageFromPath(filePath);
  const slice = content.slice(0, MAX_CONTEXT_CHARS);
  const truncNote = opts?.truncated ? "\n\n_(file truncated in preview)_" : "";
  if (opts?.startLine != null && opts?.endLine != null) {
    return (
      `Context from \`${name}\` (lines ${opts.startLine}-${opts.endLine}):\n\n` +
      `\`\`\`${lang}\n${slice}\n\`\`\`${truncNote}`
    );
  }
  return (
    `Context from file \`${filePath}\`:\n\n` +
    `\`\`\`${lang}\n${slice}\n\`\`\`${truncNote}`
  );
}

/** Reference a workspace folder for the agent. */
export function formatWorkspaceFolderBlock(folderPath: string): string {
  return (
    `Please scope work to this workspace folder:\n\n` +
    `\`\`\`\n${folderPath}\n\`\`\``
  );
}

/** Selected snippet from the workspace editor. */
export function formatWorkspaceSelectionBlock(
  filePath: string | null,
  selection: string,
): string {
  const trimmed = selection.trim();
  if (!trimmed) return "";
  if (filePath) {
    const lang = languageFromPath(filePath);
    return (
      `Selected snippet from \`${basename(filePath)}\`:\n\n` +
      `\`\`\`${lang}\n${trimmed}\n\`\`\``
    );
  }
  return `Selected snippet:\n\n\`\`\`\n${trimmed}\n\`\`\``;
}
