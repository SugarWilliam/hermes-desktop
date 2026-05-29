/** Interaction mode for the chat screen (Cursor / Qoder–style). */
export type ChatMode = "chat" | "agent" | "plan";

export const CHAT_MODE_STORAGE_KEY = "hermes.chatMode";

const PLAN_KEYWORDS = [
  "refactor",
  "architecture",
  "migrate",
  "implement",
  "redesign",
  "multi-step",
  "step by step",
  "roadmap",
  "重构",
  "架构",
  "迁移",
  "实现",
  "方案",
  "计划",
  "多步骤",
  "分步",
  "设计",
];

/** Heuristic: suggest Plan mode for large or multi-step requests. */
export function shouldSuggestPlanMode(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length >= 400) return true;
  const lower = trimmed.toLowerCase();
  return PLAN_KEYWORDS.some((k) => lower.includes(k));
}

/** System message injected at request time (not shown in transcript). */
export function chatModeSystemMessage(
  mode: ChatMode,
): { role: "system"; content: string } | null {
  if (mode === "chat") return null;
  if (mode === "agent") {
    return {
      role: "system",
      content:
        "You are in Agent mode. Take initiative: break work into steps, use " +
        "the todo tool to track tasks, use file/terminal/search tools when " +
        "helpful, verify results, and report progress. When the user attaches " +
        "files, read and analyze those files first — do not scan unrelated " +
        "parts of the repository unless asked. Prefer concrete file paths " +
        "and runnable commands.",
    };
  }
  return {
    role: "system",
    content:
      "You are in Plan mode. Do NOT execute tools or change files yet. " +
      "Produce a structured plan: goals, assumptions, step-by-step tasks, " +
      "risks, and verification. Ask clarifying questions only if blocking. " +
      "Wait for user approval before implementation.",
  };
}

interface PlanApprovalMessage {
  role?: string;
  kind?: string;
  content?: string;
}

/** True when Plan mode produced an agent reply and the user can approve execution. */
export function isPlanReadyForApproval(
  messages: PlanApprovalMessage[],
  isLoading: boolean,
  chatMode: ChatMode,
): boolean {
  if (chatMode !== "plan" || isLoading) return false;
  const bubbles = messages.filter((m) => {
    const k = m.kind;
    return !k || k === "user" || k === "assistant";
  });
  if (bubbles.length < 2) return false;
  const hasUser = bubbles.some((m) => m.role === "user" || m.kind === "user");
  const last = bubbles[bubbles.length - 1];
  const lastIsAgent = last.role === "agent" || last.kind === "assistant";
  const content = (last.content ?? "").trim();
  return hasUser && lastIsAgent && content.length > 0;
}

/** Prefix for CLI fallback when the HTTP API is unavailable. */
export function chatModeCliPrefix(mode: ChatMode): string {
  if (mode === "chat") return "";
  if (mode === "agent") return "[Agent mode] ";
  return "[Plan mode — planning only, no tool execution yet] ";
}
