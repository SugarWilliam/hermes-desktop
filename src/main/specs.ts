import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { getHermesHome } from "./config";

// ── Types ─────────────────────────────────────────────

export type SpecStatus =
  | "draft"
  | "approved"
  | "in_progress"
  | "implemented"
  | "rejected";

export interface SpecMeta {
  title: string;
  status: SpecStatus;
  created: string; // ISO 8601 date string
  sessionId: string;
}

export interface SpecEntry {
  title: string;
  status: SpecStatus;
  created: string;
  sessionId: string;
  /** The markdown content below the YAML frontmatter */
  body: string;
}

// ── Constants ─────────────────────────────────────────

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "approved",
  "in_progress",
  "implemented",
  "rejected",
]);

/**
 * Validate a status string; returns the status if valid, otherwise null.
 */
function validateStatus(raw: string): SpecStatus | null {
  const s = raw.trim().toLowerCase();
  return VALID_STATUSES.has(s) ? (s as SpecStatus) : null;
}

// ── Path helpers ──────────────────────────────────────

/**
 * Resolve the specs directory for a given profile.
 * Defaults to `~/.hermes/specs/` for the default profile,
 * or `~/.hermes/profiles/<name>/specs/` for named profiles.
 */
function specsDir(profile?: string): string {
  const home = getHermesHome(profile);
  // getHermesHome returns the profile-specific home; specs live under <home>/specs/
  return join(home, "specs");
}

/**
 * Given a spec name (without extension), return the full .md path.
 */
function specPath(name: string, profile?: string): string {
  const dir = specsDir(profile);
  return join(dir, `${name}.md`);
}

// ── Frontmatter parsing ───────────────────────────────

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * Parse simple YAML-like frontmatter from spec content.
 * This is a lightweight parser that handles the specific keys we need.
 * For more complex YAML, a full parser would be needed.
 */
function parseSpecContent(raw: string): SpecEntry | null {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return null;

  const frontmatterBlock = match[1];
  const body = match[2].trim();

  const frontmatter: Record<string, string> = {};
  const lines = frontmatterBlock.split("\n");

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  const title = frontmatter["title"] || "";
  const statusRaw = frontmatter["status"] || "draft";
  const status = validateStatus(statusRaw);
  const created = frontmatter["created"] || "";
  const sessionId = frontmatter["session_id"] || frontmatter["sessionId"] || "";

  if (!title) return null;
  if (!status) return null;

  return {
    title,
    status,
    created,
    sessionId,
    body,
  };
}

/**
 * Build YAML frontmatter string from metadata.
 */
function buildFrontmatter(meta: SpecMeta): string {
  const lines = [
    "---",
    `title: "${meta.title.replace(/"/g, '\\"')}"`,
    `status: ${meta.status}`,
    `created: ${meta.created}`,
    `session_id: ${meta.sessionId}`,
    "---",
  ];
  return lines.join("\n") + "\n";
}

// ── Public API ────────────────────────────────────────

/**
 * List all specs for a given profile.
 * Returns an array of SpecEntry objects read from all .md files in the specs directory.
 */
export function listSpecs(profile?: string): SpecEntry[] {
  const dir = specsDir(profile);

  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    const entries: SpecEntry[] = [];

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const raw = readFileSync(filePath, "utf-8");
        const entry = parseSpecContent(raw);
        if (entry) {
          entries.push(entry);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Sort by created date descending
    entries.sort((a, b) => {
      if (!a.created) return 1;
      if (!b.created) return -1;
      return b.created.localeCompare(a.created);
    });

    return entries;
  } catch {
    return [];
  }
}

/**
 * Read a single spec by name (without .md extension).
 * Returns the SpecEntry or null if not found.
 */
export function readSpec(name: string, profile?: string): SpecEntry | null {
  const fPath = specPath(name, profile);

  if (!existsSync(fPath)) {
    return null;
  }

  try {
    const raw = readFileSync(fPath, "utf-8");
    return parseSpecContent(raw);
  } catch {
    return null;
  }
}

/**
 * Create a new spec file.
 * Returns success status; fails if a spec with the same name already exists.
 */
export function createSpec(
  meta: SpecMeta,
  body: string,
  profile?: string,
): { success: boolean; error?: string } {
  const fPath = specPath(meta.title, profile);

  if (existsSync(fPath)) {
    return {
      success: false,
      error: `Spec "${meta.title}" already exists`,
    };
  }

  // Validate metadata
  if (!meta.title || !meta.title.trim()) {
    return { success: false, error: "Spec title is required" };
  }
  if (!meta.status || !VALID_STATUSES.has(meta.status)) {
    return {
      success: false,
      error: `Invalid status "${meta.status}". Must be one of: ${[...VALID_STATUSES].join(", ")}`,
    };
  }
  if (!meta.created) {
    meta = { ...meta, created: new Date().toISOString() };
  }

  // Sanitize title to a filesystem-safe name
  const safeName = meta.title
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);

  if (!safeName) {
    return { success: false, error: "Spec title must contain valid characters" };
  }

  const actualPath = specPath(safeName, profile);

  try {
    const dir = specsDir(profile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const frontmatter = buildFrontmatter({ ...meta, title: safeName });
    const content = frontmatter + "\n" + (body || "");
    writeFileSync(actualPath, content, "utf-8");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to write spec file",
    };
  }
}

/**
 * Update an existing spec's metadata and/or body.
 * Only the provided fields in `updates` are changed; omitted fields remain unchanged.
 */
export function updateSpec(
  name: string,
  updates: Partial<SpecMeta> & { body?: string },
  profile?: string,
): { success: boolean; error?: string } {
  const fPath = specPath(name, profile);

  if (!existsSync(fPath)) {
    return { success: false, error: `Spec "${name}" not found` };
  }

  try {
    const existingRaw = readFileSync(fPath, "utf-8");
    const existing = parseSpecContent(existingRaw);

    if (!existing) {
      return {
        success: false,
        error: `Failed to parse spec "${name}"`,
      };
    }

    // Validate status if provided
    if (updates.status !== undefined && !VALID_STATUSES.has(updates.status)) {
      return {
        success: false,
        error: `Invalid status "${updates.status}". Must be one of: ${[...VALID_STATUSES].join(", ")}`,
      };
    }

    const mergedMeta: SpecMeta = {
      title: updates.title ?? existing.title,
      status: updates.status ?? existing.status,
      created: updates.created ?? existing.created,
      sessionId: updates.sessionId ?? existing.sessionId,
    };

    const body = updates.body !== undefined ? updates.body : existing.body;

    const frontmatter = buildFrontmatter(mergedMeta);
    const content = frontmatter + "\n" + (body || "");

    // If the name (filename) changed, delete old and create new
    if (updates.title && updates.title !== existing.title) {
      const newPath = specPath(updates.title, profile);
      if (existsSync(newPath)) {
        return {
          success: false,
          error: `Cannot rename: spec "${updates.title}" already exists`,
        };
      }
      writeFileSync(newPath, content, "utf-8");
      // Use unlinkSync with proper error handling
      try {
        unlinkSync(fPath);
      } catch {
        // If we can't delete the old file, the new one was already written
        // which is an acceptable state
      }
    } else {
      writeFileSync(fPath, content, "utf-8");
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update spec",
    };
  }
}

/**
 * Delete a spec by name (without .md extension).
 */
export function deleteSpec(
  name: string,
  profile?: string,
): { success: boolean; error?: string } {
  const fPath = specPath(name, profile);

  if (!existsSync(fPath)) {
    return { success: false, error: `Spec "${name}" not found` };
  }

  try {
    unlinkSync(fPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete spec",
    };
  }
}
