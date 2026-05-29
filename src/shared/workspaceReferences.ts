export interface FolderReference {
  /** Basename or absolute path from `@folder:…` */
  token: string;
}

/** Extract `@folder:…` tokens (name or absolute path). Stops at CJK text without spaces. */
export function extractFolderReferences(text: string): string[] {
  const names: string[] = [];
  // Path form: @folder:C:\foo\bar or @folder:/home/foo
  for (const m of text.matchAll(/@folder:([A-Za-z]:[\\/][^\s@]+|\/[^\s@]+)/gi)) {
    const token = m[1]?.trim();
    if (token) names.push(token);
  }
  // Short name: letters, digits, underscore, hyphen, dot only
  for (const m of text.matchAll(/@folder:([A-Za-z0-9_.-]+)/gi)) {
    const token = m[1]?.trim();
    if (token && !names.includes(token)) names.push(token);
  }
  return [...new Set(names)];
}

export function isFolderPathToken(token: string): boolean {
  return (
    token.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(token) ||
    token.includes("/") ||
    token.includes("\\")
  );
}

/** True when the user explicitly asks to load project capabilities. */
export function asksToLoadCapabilities(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /加载.*能力/.test(text) ||
    /load.*capabilit/.test(lower) ||
    /\b(rules|skills|mrag)\b/.test(lower) ||
    /所有能力/.test(text)
  );
}

export function formatCapabilityIndexBlock(
  root: string,
  entries: ReadonlyArray<{ kind: string; path: string }>,
): string {
  if (entries.length === 0) {
    return (
      `Project capabilities scan for \`${root}\` found no rules/skills/mrag files.\n` +
      `Look for AGENTS.md, .hermes.md, .cursor/rules/, skills/, or mrag/ under this folder.`
    );
  }
  const lines = entries.map((e) => `- [${e.kind}] ${e.path}`);
  return (
    `Project capabilities under \`${root}\`:\n\n` +
    lines.join("\n") +
    "\n\nRead the listed files with file tools when executing the user's request."
  );
}

export function formatInlinedCapabilitiesBlock(
  root: string,
  sections: ReadonlyArray<string>,
): string {
  if (sections.length === 0) return formatCapabilityIndexBlock(root, []);
  return (
    `Loaded project capabilities from \`${root}\`:\n\n` +
    sections.join("\n\n---\n\n")
  );
}
