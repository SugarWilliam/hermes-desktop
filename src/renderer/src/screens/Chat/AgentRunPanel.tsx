import { memo } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import { ThinkingView } from "./ThinkingView";
import { AgentTodoPanel } from "./AgentTodoPanel";
import type { AgentTodoItem } from "./agentTodos";
import type { ChatMessage } from "./types";

export interface AgentRunStep {
  id: string;
  label: string;
  kind: "tool" | "progress";
  detail?: string;
  done?: boolean;
}

interface AgentRunPanelProps {
  toolProgress: string | null;
  toolProgressLog: string[];
  reasoningText: string;
  steps: AgentRunStep[];
  todos: AgentTodoItem[];
  showThinkingPlaceholder: boolean;
}

export const AgentRunPanel = memo(function AgentRunPanel({
  toolProgress,
  toolProgressLog,
  reasoningText,
  steps,
  todos,
  showThinkingPlaceholder,
}: AgentRunPanelProps): React.JSX.Element {
  const { t } = useI18n();
  const reasoning = reasoningText.trim();

  const progressLines =
    toolProgressLog.length > 0
      ? toolProgressLog
      : toolProgress
        ? [toolProgress]
        : [];

  return (
    <div className="chat-transcript-block chat-transcript-block--agent chat-message-agent-run">
      <div className="agent-run-panel">
        <div className="agent-run-panel-header">
          <Loader2 size={14} className="agent-run-spinner" aria-hidden />
          <span>{t("chat.agentWorking")}</span>
        </div>

        <details className="agent-run-section" open>
          <summary className="agent-run-section-title">
            {t("chat.thinking")}
          </summary>
          <div className="agent-run-section-body agent-run-thinking">
            <ThinkingView
              text={reasoning}
              placeholder={
                !reasoning && showThinkingPlaceholder
                  ? t("chat.agentThinkingPlaceholder")
                  : undefined
              }
            />
          </div>
        </details>

        <details className="agent-run-section" open>
          <summary className="agent-run-section-title">
            {t("chat.agentStepsTitle")}
          </summary>
          {steps.length > 0 || progressLines.length > 0 ? (
            <ul className="agent-run-steps">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={`agent-run-step ${step.done ? "agent-run-step--done" : "agent-run-step--active"}`}
                >
                  <span className="agent-run-step-label">{step.label}</span>
                  {step.detail && (
                    <span className="agent-run-step-detail">{step.detail}</span>
                  )}
                </li>
              ))}
              {progressLines.map((line, i) => (
                <li
                  key={`progress-${i}-${line}`}
                  className={`agent-run-step agent-run-step--active ${
                    i < progressLines.length - 1 ? "agent-run-step--done" : ""
                  }`}
                >
                  <span className="agent-run-step-label">{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="agent-run-section-body">
              <p className="agent-run-placeholder">
                {t("chat.agentStepsPlaceholder")}
              </p>
            </div>
          )}
        </details>

        <details
          className="agent-run-section"
          open={todos.length > 0}
        >
          <summary className="agent-run-section-title">
            {t("chat.agentTodosTitle")}
          </summary>
          <div className="agent-run-section-body">
            {todos.length > 0 ? (
              <AgentTodoPanel items={todos} embedded />
            ) : (
              <p className="agent-run-placeholder">
                {t("chat.agentTodosPlaceholder")}
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
});

/** Build tool steps from the current agent turn transcript. */
export function buildAgentRunSteps(
  turn: ReadonlyArray<ChatMessage>,
): AgentRunStep[] {
  const steps: AgentRunStep[] = [];
  const results = new Set(
    turn
      .filter((m) => m.kind === "tool_result")
      .map((m) => m.callId || m.id),
  );

  for (const m of turn) {
    if (m.kind !== "tool_call") continue;
    const flat = m.args.replace(/\s+/g, " ").trim();
    const detail = flat.length > 72 ? `${flat.slice(0, 69)}…` : flat;
    steps.push({
      id: m.id,
      label: m.name,
      kind: "tool",
      detail: detail || undefined,
      done: results.has(m.callId || m.id),
    });
  }
  return steps;
}

export function latestReasoningText(
  turn: ReadonlyArray<ChatMessage>,
): string {
  for (let i = turn.length - 1; i >= 0; i--) {
    const m = turn[i];
    if (m.kind === "reasoning" && (m.text || "").trim()) {
      return m.text;
    }
  }
  return "";
}
