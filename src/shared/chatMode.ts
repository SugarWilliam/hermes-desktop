/** Interaction mode for the chat screen (Cursor / Qoder–style). */
export type ChatMode = "chat" | "agent" | "plan" | "rigorous";

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

const RIGOROUS_KEYWORDS = [
  "严谨",
  "审计",
  "证据",
  "rigorous",
  "audit",
  "evidence",
  "verify",
  "验证",
  "方法论",
  "methodology",
];

/** Heuristic: suggest a mode for large or multi-step requests. */
export function shouldSuggestMode(text: string): ChatMode | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Rigorous mode keywords take priority
  if (RIGOROUS_KEYWORDS.some((k) => lower.includes(k))) return "rigorous";

  // Plan mode for large or complex requests
  if (trimmed.length >= 400) return "plan";
  if (PLAN_KEYWORDS.some((k) => lower.includes(k))) return "plan";

  return null;
}

/** @deprecated Use shouldSuggestMode instead. */
export function shouldSuggestPlanMode(text: string): boolean {
  return shouldSuggestMode(text) === "plan";
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
  if (mode === "rigorous") {
    return {
      role: "system",
      content:
        "You are in Rigorous mode. Follow a structured six-step analysis " +
        "pipeline for every response:\n" +
        "1. Theory Formation — articulate clear hypotheses and assumptions.\n" +
        "2. Calibration — validate assumptions against known benchmarks.\n" +
        "3. Adapter Selection — choose appropriate analytical frameworks.\n" +
        "4. Coupling Analysis — map relationships between components.\n" +
        "5. Perturbation Testing — stress-test conclusions with edge cases.\n" +
        "6. Report Generation — produce auditable output with evidence levels.\n\n" +
        "EVIDENCE HIERARCHY: Tag every claim with a confidence level:\n" +
        "- C1: Strong evidence (verified data / reproducible tests)\n" +
        "- C2: Moderate evidence (informed by documentation / patterns)\n" +
        "- C3: Weak evidence (analogy / extrapolation)\n" +
        "- C4: Speculative (educated guess without direct support)\n\n" +
        "CONSTRAINTS:\n" +
        "- Never assert without citing evidence level.\n" +
        "- If evidence is insufficient, explicitly state the gap.\n" +
        "- Prefer C1/C2 claims; flag C3/C4 as uncertain.\n" +
        "- Use mermaid diagrams for system architecture when helpful.\n" +
        "- Provide an audit trail that allows verification of each conclusion.",
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
  if (mode === "rigorous") return "[Rigorous mode — structured analysis pipeline] ";
  return "[Plan mode — planning only, no tool execution yet] ";
}
