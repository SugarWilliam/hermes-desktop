import { readdirSync, readFileSync, statSync } from "fs";
import { join, basename, resolve } from "path";
import {
  asksToLoadCapabilities,
  extractFolderReferences,
  formatCapabilityIndexBlock,
  formatInlinedCapabilitiesBlock,
  isFolderPathToken,
} from "../shared/workspaceReferences";
import { formatWorkspaceFolderBlock } from "../shared/workspaceContext";

const MAX_SINGLE_FILE = 24 * 1024;
const MAX_TOTAL_INLINE = 64 * 1024;
const MAX_RULE_FILES = 24;
const MAX_SKILL_FILES = 40;
const MAX_SCAN_DEPTH = 6;

export interface CapabilityEntry {
  kind: string;
  path: string;
}

const ROOT_CONTEXT_FILES: Array<{ name: string; kind: string }> = [
  { name: "AGENTS.md", kind: "agents" },
  { name: ".hermes.md", kind: "hermes" },
  { name: "HERMES.md", kind: "hermes" },
  { name: "SOUL.md", kind: "soul" },
  { name: ".cursorrules", kind: "cursorrules" },
];

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function readTextFile(path: string, max = MAX_SINGLE_FILE): string {
  try {
    const buf = readFileSync(path);
    const slice = buf.length > max ? buf.subarray(0, max) : buf;
    const text = slice.toString("utf-8");
    return buf.length > max ? `${text}\n\n_(truncated)_` : text;
  } catch {
    return "";
  }
}

/** Find a directory by name under root (BFS, case-insensitive on Windows). */
export function findDirectoryByName(
  contextRoot: string,
  folderName: string,
  maxDepth = 8,
): string | null {
  const root = contextRoot.trim();
  if (!root || !folderName) return null;
  const want = folderName.toLowerCase();
  if (basename(root).toLowerCase() === want) return root;

  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!;
    if (depth > maxDepth) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist") {
        continue;
      }
      const full = join(dir, ent.name);
      if (ent.name.toLowerCase() === want) return full;
      if (depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

/** Resolve `@folder:…` to an absolute directory path. */
export function resolveFolderUnderRoot(
  contextRoot: string,
  folderToken: string,
): string | null {
  const root = contextRoot.trim();
  const token = folderToken.trim();
  if (!root || !token) return null;

  if (isFolderPathToken(token)) {
    const abs = resolve(token);
    if (isDir(abs)) return abs;
    // Path relative to context root
    const under = resolve(root, token);
    if (isDir(under)) return under;
    return null;
  }

  const direct = join(root, token);
  if (isDir(direct)) return direct;

  try {
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (ent.name.toLowerCase() === token.toLowerCase()) {
        return join(root, ent.name);
      }
    }
  } catch {
    /* ignore */
  }

  return findDirectoryByName(root, token);
}

function walkSkillFiles(
  dir: string,
  out: CapabilityEntry[],
  depth: number,
): void {
  if (depth > MAX_SCAN_DEPTH || out.length >= MAX_SKILL_FILES) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") && ent.name !== ".agents") continue;
    const full = join(dir, ent.name);
    if (ent.isFile() && ent.name === "SKILL.md") {
      out.push({ kind: "skill", path: full });
      if (out.length >= MAX_SKILL_FILES) return;
    } else if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "out") {
        continue;
      }
      walkSkillFiles(full, out, depth + 1);
    }
  }
}

function collectRuleFiles(dir: string, out: CapabilityEntry[]): void {
  if (!isDir(dir) || out.length >= MAX_RULE_FILES) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (out.length >= MAX_RULE_FILES) break;
    const full = join(dir, ent.name);
    if (ent.isFile() && /\.(md|mdc|txt)$/i.test(ent.name)) {
      out.push({ kind: "rule", path: full });
    }
  }
}

export function scanProjectCapabilities(root: string): CapabilityEntry[] {
  const entries: CapabilityEntry[] = [];
  if (!isDir(root)) return entries;

  for (const spec of ROOT_CONTEXT_FILES) {
    const p = join(root, spec.name);
    if (isFile(p)) entries.push({ kind: spec.kind, path: p });
  }

  collectRuleFiles(join(root, ".cursor", "rules"), entries);
  collectRuleFiles(join(root, "rules"), entries);

  walkSkillFiles(join(root, ".agents", "skills"), entries, 0);
  walkSkillFiles(join(root, "skills"), entries, 0);
  walkSkillFiles(join(root, ".cursor", "skills"), entries, 0);

  const mragDir = join(root, "mrag");
  if (isDir(mragDir)) {
    entries.push({ kind: "mrag", path: mragDir });
    for (const name of ["README.md", "index.md", "INDEX.md"]) {
      const p = join(mragDir, name);
      if (isFile(p)) entries.push({ kind: "mrag-doc", path: p });
    }
  }
  const dotMrag = join(root, ".mrag");
  if (isDir(dotMrag)) entries.push({ kind: "mrag", path: dotMrag });

  return entries;
}

function inlineSections(
  entries: CapabilityEntry[],
  deep: boolean,
): string[] {
  const sections: string[] = [];
  let total = 0;

  for (const ent of entries) {
    if (!deep) break;
    if (ent.kind === "mrag" && isDir(ent.path)) continue;
    if (!isFile(ent.path)) continue;
    const body = readTextFile(ent.path);
    if (!body.trim()) continue;
    const header = `### ${ent.kind}: ${basename(ent.path)} (\`${ent.path}\`)\n\n`;
    const chunk = header + body;
    if (total + chunk.length > MAX_TOTAL_INLINE) break;
    sections.push(chunk);
    total += chunk.length;
  }
  return sections;
}

export interface ExpandedWorkspaceMessage {
  message: string;
  capabilitySystem: string | null;
}

/**
 * Expand compact `@folder:` UI references into agent-visible payloads and
 * optionally inline project rules/skills/mrag for capability-loading requests.
 */
export function expandWorkspaceMessage(
  message: string,
  contextFolder?: string,
): ExpandedWorkspaceMessage {
  const root = contextFolder?.trim();
  if (!root) {
    return { message, capabilitySystem: null };
  }

  const folderRefs = extractFolderReferences(message);
  const targets = new Set<string>();
  const parts: string[] = [message.trim()];
  const systemParts: string[] = [];

  if (folderRefs.length > 0) {
    for (const name of folderRefs) {
      const resolved = resolveFolderUnderRoot(root, name);
      if (resolved) {
        targets.add(resolved);
        parts.push(
          `Resolved @folder reference to absolute path: \`${resolved}\`\n` +
            `Use ONLY this directory for rules, skills, mrag, and file tools — not ~/.hermes/skills unless the user asks for global Hermes skills.`,
        );
      } else {
        const hint = isFolderPathToken(name)
          ? `Path \`${name}\` is not accessible.`
          : `Folder \`${name}\` was not found under context root \`${root}\`.`;
        parts.push(`Note: @folder:${name} — ${hint}`);
        try {
          const subdirs = readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !e.name.startsWith("."))
            .map((e) => e.name)
            .slice(0, 30);
          if (subdirs.length > 0) {
            parts.push(
              `Top-level folders under context root:\n${subdirs.map((d) => `- ${d}`).join("\n")}`,
            );
          }
        } catch {
          /* ignore */
        }
      }
    }
  } else if (asksToLoadCapabilities(message)) {
    targets.add(root);
  }

  const deepInline =
    asksToLoadCapabilities(message) || folderRefs.length > 0;

  for (const target of targets) {
    parts.push(formatWorkspaceFolderBlock(target));
    const entries = scanProjectCapabilities(target);
    if (deepInline) {
      const sections = inlineSections(entries, true);
      parts.push(formatInlinedCapabilitiesBlock(target, sections));
      if (sections.length === 0) {
        parts.push(formatCapabilityIndexBlock(target, entries));
      }
    } else {
      systemParts.push(formatCapabilityIndexBlock(target, entries));
    }
  }

  if (targets.size === 0 && asksToLoadCapabilities(message)) {
    const entries = scanProjectCapabilities(root);
    const sections = inlineSections(entries, true);
    parts.push(formatInlinedCapabilitiesBlock(root, sections));
    if (sections.length === 0) {
      parts.push(formatCapabilityIndexBlock(root, entries));
    }
  }

  return {
    message: parts.filter(Boolean).join("\n\n"),
    capabilitySystem: systemParts.length > 0 ? systemParts.join("\n\n") : null,
  };
}
