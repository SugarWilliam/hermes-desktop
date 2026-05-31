import { existsSync, readFileSync, readdirSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import { profileHome, safeWriteFile } from "./utils";

// ── Types ────────────────────────────────────────────

export type RuleType = "always_on" | "model_decision" | "glob";

export interface RuleMeta {
  name: string;
  type: RuleType;
  glob: string;
  description: string;
  priority: number;
  path: string; // absolute path to the rule file on disk
}

export interface RuleContent {
  meta: RuleMeta;
  body: string; // markdown content after frontmatter
}

// ── Storage ──────────────────────────────────────────

function rulesDir(profile?: string): string {
  const dir = join(profileHome(profile), "rules");
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* best-effort */
    }
  }
  return dir;
}

function ruleFilePath(name: string, profile?: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(rulesDir(profile), `${safe}.md`);
}

// ── Frontmatter parsing ──────────────────────────────

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

function parseRuleFrontmatter(raw: string): {
  meta: RuleMeta | null;
  body: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { meta: null, body: raw };

  const fmText = match[1];
  const body = raw.slice(match[0].length).trim();
  const fm: Record<string, string> = {};
  for (const line of fmText.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    fm[key] = val;
  }

  const name = fm.name || basename(raw, extname(raw));
  const type = (fm.type as RuleType) || "model_decision";
  const validTypes: RuleType[] = ["always_on", "model_decision", "glob"];
  const validatedType = validTypes.includes(type) ? type : "model_decision";

  return {
    meta: {
      name,
      type: validatedType,
      glob: fm.glob || "",
      description: fm.description || "",
      priority: parseInt(fm.priority, 10) || 0,
      path: "",
    },
    body,
  };
}

function serializeRuleFrontmatter(meta: RuleMeta, body: string): string {
  let fm = "---\n";
  fm += `name: "${meta.name}"\n`;
  fm += `type: ${meta.type}\n`;
  if (meta.glob) fm += `glob: "${meta.glob}"\n`;
  if (meta.description) fm += `description: "${meta.description}"\n`;
  if (meta.priority) fm += `priority: ${meta.priority}\n`;
  fm += "---\n\n";
  return fm + (body || "");
}

// ── Read ─────────────────────────────────────────────

export function listRules(profile?: string): RuleMeta[] {
  const dir = rulesDir(profile);
  if (!existsSync(dir)) return [];

  const results: RuleMeta[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      const path = join(dir, entry);
      try {
        const raw = readFileSync(path, "utf-8");
        const { meta } = parseRuleFrontmatter(raw);
        if (meta) {
          meta.path = path;
          results.push(meta);
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    /* ignore */
  }
  results.sort((a, b) => a.priority - b.priority);
  return results;
}

export function readRuleContent(fullPath: string): RuleContent | null {
  try {
    const raw = readFileSync(fullPath, "utf-8");
    const { meta, body } = parseRuleFrontmatter(raw);
    if (!meta) return null;
    meta.path = fullPath;
    return { meta, body };
  } catch {
    return null;
  }
}

// ── Write operations ─────────────────────────────────

export function createRule(
  name: string,
  type: RuleType,
  glob: string,
  description: string,
  body: string,
  priority = 0,
  profile?: string,
): { success: boolean; error?: string; path?: string } {
  const targetPath = ruleFilePath(name, profile);
  if (existsSync(targetPath)) {
    return { success: false, error: `Rule "${name}" already exists` };
  }
  const meta: RuleMeta = {
    name,
    type,
    glob,
    description,
    priority,
    path: targetPath,
  };
  const content = serializeRuleFrontmatter(meta, body);
  try {
    safeWriteFile(targetPath, content);
    return { success: true, path: targetPath };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function updateRule(
  name: string,
  updates: {
    type?: RuleType;
    glob?: string;
    description?: string;
    body?: string;
    priority?: number;
  },
  profile?: string,
): { success: boolean; error?: string } {
  const targetPath = ruleFilePath(name, profile);
  if (!existsSync(targetPath)) {
    return { success: false, error: `Rule "${name}" not found` };
  }
  try {
    const raw = readFileSync(targetPath, "utf-8");
    const { meta, body } = parseRuleFrontmatter(raw);
    if (!meta) return { success: false, error: "Failed to parse rule" };

    if (updates.type !== undefined) meta.type = updates.type;
    if (updates.glob !== undefined) meta.glob = updates.glob;
    if (updates.description !== undefined) meta.description = updates.description;
    if (updates.priority !== undefined) meta.priority = updates.priority;
    const newBody = updates.body !== undefined ? updates.body : body;
    meta.path = targetPath;

    const content = serializeRuleFrontmatter(meta, newBody);
    safeWriteFile(targetPath, content);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function deleteRule(
  name: string,
  profile?: string,
): { success: boolean; error?: string } {
  const targetPath = ruleFilePath(name, profile);
  if (!existsSync(targetPath)) {
    return { success: false, error: "Rule not found" };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { unlinkSync } = require("fs");
    unlinkSync(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Glob matching ────────────────────────────────────

function globToRegex(glob: string): RegExp | null {
  if (!glob) return null;
  try {
    let pattern = glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/**
 * Check whether any glob rule matches the given file path.
 * Returns the list of matching rule metas (for prompt injection).
 */
export function matchGlobRules(
  filePath: string,
  profile?: string,
): RuleMeta[] {
  const rules = listRules(profile).filter((r) => r.type === "glob" && r.glob);
  if (rules.length === 0) return [];

  const fileName = basename(filePath);
  const matches: RuleMeta[] = [];
  for (const rule of rules) {
    for (const g of rule.glob.split(",")) {
      const trimmed = g.trim();
      if (!trimmed) continue;
      const re = globToRegex(trimmed);
      if (re && (re.test(filePath) || re.test(fileName))) {
        matches.push(rule);
        break;
      }
    }
  }
  return matches;
}

// ── Prompt injection ─────────────────────────────────

/**
 * Build the system message content for applicable rules.
 *
 * - `always_on` rules: injected in full.
 * - `model_decision` rules: injected as a summary list with descriptions.
 * - `glob` rules: only injected when a matching file path is found
 *   in the conversation (matched by `matchGlobRules`).
 *
 * Returns a string suitable for a `role: "system"` message, or `null`
 * when no rules are applicable.
 */
export function getApplicableRulesPrompt(
  workspacePaths?: string[],
  profile?: string,
): string | null {
  const allRules = listRules(profile);
  if (allRules.length === 0) return null;

  const alwaysOn = allRules.filter((r) => r.type === "always_on");
  const modelDecision = allRules.filter((r) => r.type === "model_decision");

  // Glob rules: match against workspace paths mentioned in the conversation
  let globRules: RuleMeta[] = [];
  if (workspacePaths && workspacePaths.length > 0) {
    for (const path of workspacePaths) {
      globRules.push(...matchGlobRules(path, profile));
    }
  }
  // Deduplicate glob rules
  const seenGlob = new Set<string>();
  globRules = globRules.filter((r) => {
    if (seenGlob.has(r.path)) return false;
    seenGlob.add(r.path);
    return true;
  });

  const parts: string[] = [];

  // Always-on rules: full injection
  if (alwaysOn.length > 0) {
    parts.push("## Rules (always active)\n");
    for (const rule of alwaysOn) {
      const content = readRuleContent(rule.path);
      if (content) {
        parts.push(`### ${rule.name}`);
        parts.push(content.body);
        parts.push("");
      }
    }
  }

  // Model decision rules: summary list
  if (modelDecision.length > 0) {
    parts.push("## Available Rules\n");
    parts.push(
      "The following rules are available. Consider them when relevant to the user's request:\n",
    );
    for (const rule of modelDecision) {
      parts.push(
        `- **${rule.name}**: ${rule.description || "No description"}`,
      );
    }
    parts.push("");
  }

  // Glob rules: inject matched rules in full
  if (globRules.length > 0) {
    parts.push("## Matched File Rules\n");
    parts.push(
      "The following rules matched files mentioned in the conversation:\n",
    );
    for (const rule of globRules) {
      const content = readRuleContent(rule.path);
      if (content) {
        parts.push(`### ${rule.name}`);
        parts.push(content.body);
        parts.push("");
      }
    }
  }

  const result = parts.join("\n").trim();
  return result || null;
}

/**
 * Install preset rules on first run. These are pre-built best-practice rules
 * that users can keep, modify, or delete.
 */
export function installPresetRules(profile?: string): string[] {
  const installed: string[] = [];

  // Only install if rules dir is empty (first-run detection)
  const existing = listRules(profile);
  if (existing.length > 0) return installed;

  const presets: Array<{
    name: string;
    type: RuleType;
    description: string;
    body: string;
    priority: number;
  }> = [
    {
      name: "meta-framework-core",
      type: "always_on",
      priority: 100,
      description:
        "MetaFramework v4.5.0 six-step rigorous analysis pipeline with C1-C4 evidence hierarchy",
      body: `# MetaFramework Core — Rigorous Analysis Pipeline

Follow this six-step pipeline for complex analysis tasks:

## 1. Theory Formation
- Articulate clear hypotheses and assumptions.
- Define the question boundaries explicitly.
- Identify what success looks like.

## 2. Calibration
- Validate assumptions against known benchmarks.
- Check for data availability and quality.
- Identify potential confounding variables.

## 3. Adapter Selection
- Choose appropriate analytical frameworks.
- Select the right tools and models for the task.
- Justify why each adapter is appropriate.

## 4. Coupling Analysis
- Map relationships between components.
- Identify direct and indirect dependencies.
- Assess interaction effects.

## 5. Perturbation Testing
- Stress-test conclusions with edge cases.
- Apply robustness checks.
- Use bootstrap or cross-validation where appropriate.

## 6. Report Generation
- Produce auditable output with evidence levels.
- Provide full provenance chain.
- Include uncertainty quantification.

## Evidence Hierarchy
- C1: Strong evidence (verified data / reproducible tests / peer-reviewed)
- C2: Moderate evidence (documentation / established patterns / replicable)
- C3: Weak evidence (analogy / extrapolation / indirect support)
- C4: Speculative (educated guess / expert intuition without direct support)
`,
    },
    {
      name: "meta-framework-audit",
      type: "model_decision",
      priority: 200,
      description: "Audit trail requirement: every claim must cite evidence source and confidence level",
      body: `# Audit Trail Requirements

When producing analysis results, ensure every claim is auditable:

1. **Evidence Tagging**: Each factual claim should be tagged with [C1]-[C4] confidence level.
2. **Source Citation**: Cite the origin of evidence (file path, URL, reasoning chain).
3. **Gap Documentation**: If evidence is insufficient, explicitly state the gap rather than filling it with speculation.
4. **Reproducibility**: Prefer claims that can be verified by the user. Provide steps to reproduce when possible.
5. **Uncertainty Quantification**: Use ranges or confidence intervals rather than single-point claims when data is noisy.
`,
    },
    {
      name: "meta-framework-hallucination",
      type: "always_on",
      priority: 300,
      description: "Anti-hallucination constraints: verify before asserting, distinguish known from unknown",
      body: `# Anti-Hallucination Constraints

1. **Verify Before Assert**: Check file contents, documentation, or known facts before making claims about the codebase.
2. **Distinguish Known from Unknown**: Use "I can see that..." vs "I would expect that..." vs "It is possible that..."
3. **No Fabricated APIs**: Never invent function signatures, package names, or configuration keys. If unsure, search first.
4. **Reading Before Writing**: Always read a file before proposing changes to it.
5. **Explicit Disclaimers**: When making educated guesses, prefix with "Based on the available information, ..."
6. **Cross-Reference**: When multiple sources exist, cross-reference them. Flag inconsistencies.
`,
    },
    {
      name: "typescript-best-practices",
      type: "model_decision",
      priority: 400,
      description: "TypeScript coding standards and best practices",
      body: `# TypeScript Best Practices

- Use strict TypeScript. Avoid \`any\`; prefer \`unknown\` or proper types.
- Use \`const\` assertions for readonly data.
- Prefer \`interface\` over \`type\` for object shapes unless you need unions.
- Use discriminated unions for state machines.
- Avoid optional chaining in hot paths; use early returns instead.
- Keep files under 300 lines. Extract helpers when they grow.
- Prefer \`Array<T>\` over \`T[]\` for complex generics.
`,
    },
    {
      name: "code-review-checklist",
      type: "model_decision",
      priority: 500,
      description: "Code review checklist for evaluating changes",
      body: `# Code Review Checklist

When reviewing or creating code changes:

1. **Correctness**: Does the code do what it claims?
2. **Security**: Any injection vectors, exposed secrets, or unsafe operations?
3. **Performance**: Any N+1 queries, unnecessary loops, or memory leaks?
4. **Error Handling**: Are all error paths covered? No silent failures?
5. **Testing**: Are there tests for the happy path and edge cases?
6. **Naming**: Are variable and function names clear and consistent?
7. **Comments**: Do comments explain WHY, not WHAT?
8. **Dependencies**: Any unnecessary new dependencies?
`,
    },
  ];

  for (const preset of presets) {
    const result = createRule(
      preset.name,
      preset.type,
      "",
      preset.description,
      preset.body,
      preset.priority,
      profile,
    );
    if (result.success) installed.push(preset.name);
  }

  return installed;
}
