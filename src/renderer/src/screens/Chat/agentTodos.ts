import type { ChatMessage } from "./types";

export type AgentTodoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface AgentTodoItem {
  id: string;
  content: string;
  status: AgentTodoStatus;
}

function normalizeStatus(raw: unknown): AgentTodoStatus {
  const s = String(raw || "pending").toLowerCase();
  if (s === "in_progress" || s === "in-progress" || s === "doing") {
    return "in_progress";
  }
  if (s === "completed" || s === "done" || s === "complete") {
    return "completed";
  }
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "pending";
}

function parseTodoPayload(args: string): AgentTodoItem[] | null {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    const raw =
      parsed.todos ?? parsed.items ?? parsed.merge ?? parsed.updates;
    if (!Array.isArray(raw)) return null;
    const out: AgentTodoItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const content = String(row.content ?? row.title ?? row.text ?? "").trim();
      if (!content) continue;
      out.push({
        id: String(row.id ?? `todo-${out.length}`),
        content,
        status: normalizeStatus(row.status),
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function parseTodoResult(content: string): AgentTodoItem[] | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (Array.isArray(parsed.todos)) {
      return parseTodoPayload(JSON.stringify({ todos: parsed.todos }));
    }
  } catch {
    /* plain text result */
  }
  return null;
}

/** Latest todo list from todo_write / todo tool calls in the transcript. */
export function extractLatestAgentTodos(
  messages: ReadonlyArray<ChatMessage>,
): AgentTodoItem[] {
  let latest: AgentTodoItem[] = [];

  for (const m of messages) {
    if (m.kind === "tool_call" && /todo/i.test(m.name)) {
      const parsed = parseTodoPayload(m.args);
      if (parsed) latest = parsed;
    }
    if (m.kind === "tool_result" && /todo/i.test(m.name)) {
      const parsed = parseTodoResult(m.content);
      if (parsed) latest = parsed;
    }
  }

  return latest;
}

/** Todos written during the current agent turn (after last user message). */
export function extractCurrentTurnTodos(
  messages: ReadonlyArray<ChatMessage>,
): AgentTodoItem[] {
  let start = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" || (m as { kind?: string }).kind === "user") {
      start = i + 1;
      break;
    }
  }
  return extractLatestAgentTodos(messages.slice(start));
}
