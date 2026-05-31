// ── Types ─────────────────────────────────────────────

export interface ParsedTask {
  /** Unique task identifier, e.g. "T1", "task-001" */
  id: string;
  /** Task description content */
  content: string;
  /** Nested subtasks */
  subtasks: ParsedTask[];
  /** IDs of tasks this task depends on */
  dependsOn: string[];
}

export interface ParsedPlan {
  /** Plan title, extracted from the first heading or "Untitled Plan" */
  title: string;
  /** High-level goals */
  goals: string[];
  /** Ordered task list */
  tasks: ParsedTask[];
  /** Known risks / potential pitfalls */
  risks: string[];
  /** Verification / acceptance criteria text */
  verification: string;
}

// ── Parser helpers ────────────────────────────────────

const HEADER_RE = /^#{1,3}\s+(.+?)\s*$/;
const LIST_ITEM_RE = /^(?:\d+[).]\s+|[-*+]\s+)(.+)$/;

/** Extract a task ID from patterns like [T1], [TASK-001], [id: foo] */
const TASK_ID_RE = /\[([A-Za-z0-9_-]+)\]/;

/** Extract dependencies from patterns like "(depends on T1)" or "[dep: T1,T2]" */
const DEP_RE = /\(depends?\s+on\s+([^)]+)\)/i;
const DEP_BRACKET_RE = /\[dep:\s*([^\]]+)\]/i;

/**
 * Generate a sequential task ID when none is found in the text.
 */
function generateTaskId(index: number): string {
  return `task-${index}`;
}

/**
 * Extract a task ID from a line of text. Returns the ID if found, otherwise null.
 */
function extractTaskId(text: string): string | null {
  const match = TASK_ID_RE.exec(text);
  if (!match) return null;
  const raw = match[1].toUpperCase();
  // Only accept IDs that look like task identifiers
  if (/^(T\d+|TASK-\d+|[A-Z]+\d*)$/.test(raw)) return raw;
  if (/^[a-z0-9_-]+$/.test(raw) && raw.length > 1) return raw;
  return null;
}

/**
 * Extract dependency references from a line of text.
 * Returns an array of task IDs (normalized to uppercase).
 */
function extractDeps(text: string): string[] {
  const deps: string[] = [];

  // (depends on T1, T2)
  const depMatch = DEP_RE.exec(text);
  if (depMatch) {
    const ids = depMatch[1].split(/[,;]+/).map((s) => s.trim().toUpperCase());
    for (const id of ids) {
      const clean = id.replace(/^\[|\]$/g, "");
      if (clean) deps.push(clean);
    }
  }

  // [dep: T1, T2]
  const bracketMatch = DEP_BRACKET_RE.exec(text);
  if (bracketMatch) {
    const ids = bracketMatch[1].split(/[,;]+/).map((s) => s.trim().toUpperCase());
    for (const id of ids) {
      if (id) deps.push(id);
    }
  }

  return deps;
}

/**
 * Strip task ID and dependency annotations from a task content line,
 * leaving only the human-readable description.
 */
function cleanTaskContent(text: string): string {
  let cleaned = text
    // Remove leading task ID brackets like [T1]
    .replace(/^\s*\[[A-Za-z0-9_-]+\]\s*/, "")
    // Remove [dep: ...] annotations
    .replace(/\s*\[dep:\s*[^\]]+\]\s*/gi, "")
    // Remove (depends on ...) annotations
    .replace(/\s*\(depends?\s+on\s+[^)]+\)\s*/gi, "")
    // Remove trailing task IDs in brackets at end
    .replace(/\s*\[[A-Za-z0-9_-]+\]\s*$/, "")
    .trim();

  // Also strip a leading list marker like "1." or "-"
  cleaned = cleaned.replace(/^\d+[).]\s*/, "").replace(/^[-*+]\s*/, "").trim();

  return cleaned;
}

// ── Section parsing ───────────────────────────────────

interface RawSection {
  title: string;
  lines: string[];
}

/**
 * Split the raw markdown text into named sections based on ## or ### headings.
 */
function splitSections(text: string): RawSection[] {
  const lines = text.split("\n");
  const sections: RawSection[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  // Detect the overall plan title from the first # heading
  let planTitle = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = HEADER_RE.exec(trimmed);
    if (headerMatch) {
      const heading = headerMatch[1].trim();
      // First heading becomes plan title, subsequent ones become sections
      if (!planTitle && (trimmed.startsWith("# ") || trimmed.startsWith("## "))) {
        planTitle = heading;
      } else {
        // Flush current section
        if (currentLines.length > 0) {
          sections.push({ title: currentTitle || "General", lines: currentLines });
        }
        currentTitle = heading;
        currentLines = [];
      }
      continue;
    }

    currentLines.push(trimmed);
  }

  // Flush last section
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle || "General", lines: currentLines });
  }

  return sections;
}

/**
 * Parse bullet/dash list items from an array of lines.
 */
function parseBulletList(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    const match = LIST_ITEM_RE.exec(line);
    if (match) {
      const content = match[1].trim();
      if (content.length > 0) {
        items.push(content);
      }
    } else if (line.length > 0 && !HEADER_RE.test(line)) {
      // Non-list content in a section: treat as a single item
      items.push(line);
    }
  }
  return items;
}

/**
 * Parse task entries from markdown lines.
 * Handles numbered lists with optional [T1] IDs and (depends on ...) annotations.
 * Subtasks are lines indented with spaces below a parent task.
 */
function parseTasks(lines: string[]): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const taskStack: ParsedTask[] = [];
  let taskIdx = 0;

  for (const line of lines) {
    // Determine indentation level
    const indentMatch = /^(\s*)/.exec(line);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Pop back to appropriate indentation level
    while (taskStack.length > 0 && indent <= taskStack[taskStack.length - 1].content.length * 0) {
      // We use a simpler heuristic: if indent is <= the indent of the current parent, pop
      break;
    }

    const isListItem = LIST_ITEM_RE.test(trimmed);

    if (isListItem) {
      taskIdx++;
      const content = cleanTaskContent(trimmed);
      const id = extractTaskId(trimmed) || generateTaskId(taskIdx);
      const deps = extractDeps(trimmed);

      const task: ParsedTask = {
        id,
        content,
        subtasks: [],
        dependsOn: deps,
      };

      if (indent > 0 && taskStack.length > 0) {
        // This is a subtask of the last task at parent level
        taskStack[taskStack.length - 1].subtasks.push(task);
      } else {
        tasks.push(task);
        // Reset stack; this becomes the new parent
        taskStack.length = 0;
        taskStack.push(task);
      }
    }
  }

  return tasks;
}

// ── Public API ────────────────────────────────────────

/**
 * Parse an agent's plan-mode markdown output into a structured ParsedPlan.
 *
 * Expected format:
 *
 * ## Goals
 * - Goal 1
 * - Goal 2
 *
 * ## Tasks
 * 1. [T1] Task description
 *    - Subtask detail
 * 2. [T2] Another task (depends on T1)
 *
 * ## Risks
 * - Risk 1
 * - Risk 2
 *
 * ## Verification
 * - How to verify...
 */
export function parsePlanOutput(text: string): ParsedPlan {
  if (!text || !text.trim()) {
    return {
      title: "Untitled Plan",
      goals: [],
      tasks: [],
      risks: [],
      verification: "",
    };
  }

  const sections = splitSections(text);

  let title = "";
  const goals: string[] = [];
  const tasks: ParsedTask[] = [];
  const risks: string[] = [];
  let verification = "";

  for (const section of sections) {
    const lowerTitle = section.title.toLowerCase();

    if (!title && section === sections[0]) {
      // First section title is the plan title
      title = section.title;
    }

    if (lowerTitle.includes("goal") || lowerTitle.includes("objective")) {
      goals.push(...parseBulletList(section.lines));
    } else if (
      lowerTitle.includes("task") ||
      lowerTitle.includes("step") ||
      lowerTitle.includes("implementation")
    ) {
      const parsed = parseTasks(section.lines);
      tasks.push(...parsed);
    } else if (lowerTitle.includes("risk") || lowerTitle.includes("concern")) {
      risks.push(...parseBulletList(section.lines));
    } else if (
      lowerTitle.includes("verif") ||
      lowerTitle.includes("acceptance") ||
      lowerTitle.includes("test") ||
      lowerTitle.includes("check")
    ) {
      verification = section.lines.join("\n").trim();
    } else if (section.lines.length > 0 && !goals.length && !tasks.length) {
      // Unrecognized section with content that precedes goals/tasks:
      // treat as additional goals or the plan body
      goals.push(...parseBulletList(section.lines));
    }
  }

  return {
    title: title || "Untitled Plan",
    goals,
    tasks,
    risks,
    verification,
  };
}

/**
 * Convert a ParsedPlan back to a markdown string suitable for display
 * or injection into the conversation context.
 */
export function planToMarkdown(plan: ParsedPlan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.title}`);
  lines.push("");

  if (plan.goals.length > 0) {
    lines.push("## Goals");
    for (const goal of plan.goals) {
      lines.push(`- ${goal}`);
    }
    lines.push("");
  }

  if (plan.tasks.length > 0) {
    lines.push("## Tasks");
    let counter = 1;
    for (const task of plan.tasks) {
      const depSuffix =
        task.dependsOn.length > 0
          ? ` (depends on ${task.dependsOn.join(", ")})`
          : "";
      lines.push(`${counter}. [${task.id}] ${task.content}${depSuffix}`);
      for (const subtask of task.subtasks) {
        lines.push(`   - ${subtask.content}`);
      }
      counter++;
    }
    lines.push("");
  }

  if (plan.risks.length > 0) {
    lines.push("## Risks");
    for (const risk of plan.risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  if (plan.verification) {
    lines.push("## Verification");
    lines.push(plan.verification);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Flatten all tasks (including subtasks recursively) into a linear,
 * ordered array of task content strings.
 */
export function extractTasks(plan: ParsedPlan): string[] {
  const result: string[] = [];

  function walk(task: ParsedTask): void {
    result.push(task.content);
    for (const subtask of task.subtasks) {
      walk(subtask);
    }
  }

  for (const task of plan.tasks) {
    walk(task);
  }

  return result;
}
