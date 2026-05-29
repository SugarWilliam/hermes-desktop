import { memo, useMemo, useState } from "react";
import {
  Brain,
  ChevronDown,
  Check,
  Loader2,
  Terminal,
  Search,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { useI18n } from "../../components/useI18n";
import { AgentMarkdown } from "../../components/AgentMarkdown";
import { ThinkingView } from "./ThinkingView";
import { AgentTodoPanel } from "./AgentTodoPanel";
import type { AgentTodoItem } from "./agentTodos";
import type { AgentTurnPhases, ExecutionItem } from "./agentTurnPhases";
import type { AgentRunStep } from "./AgentRunPanel";
import type { StreamStallState } from "./hooks/useStreamStall";

interface AgentTurnViewProps {
  phases: AgentTurnPhases;
  isLive?: boolean;
  toolProgress?: string | null;
  toolProgressLog?: string[];
  liveSteps?: AgentRunStep[];
  todos?: AgentTodoItem[];
  showThinkingPlaceholder?: boolean;
  isLast?: boolean;
  onApprove?: () => void;
  onDeny?: () => void;
  needsApproval?: boolean;
  streamStall?: StreamStallState;
  onAbort?: () => void;
}

function ExecutionLine({
  item,
}: {
  item: ExecutionItem;
}): React.JSX.Element {
  const { t } = useI18n();

  if (item.type === "viewed") {
    return (
      <div className="paradigm-exec-line paradigm-exec-line--viewed">
        <Check size={12} className="paradigm-exec-icon paradigm-exec-icon--done" />
        <span>
          {t("chat.phase.viewed")} <span className="paradigm-exec-em">{item.name}</span>
        </span>
      </div>
    );
  }

  if (item.type === "skill") {
    return (
      <div className="paradigm-exec-line paradigm-exec-line--skill">
        {item.done ? (
          <Check size={12} className="paradigm-exec-icon paradigm-exec-icon--done" />
        ) : (
          <Loader2 size={12} className="paradigm-exec-icon paradigm-exec-spin" />
        )}
        <span>
          Skill <span className="paradigm-exec-em">{item.name}</span>
        </span>
      </div>
    );
  }

  if (item.type === "terminal") {
    return (
      <div className="paradigm-terminal">
        <div className="paradigm-terminal-bar">
          {item.running ? (
            <Loader2 size={13} className="paradigm-exec-spin" />
          ) : (
            <Terminal size={13} />
          )}
          <span>{t("chat.phase.terminalRunning")}</span>
        </div>
        <pre className="paradigm-terminal-cmd">{item.command}</pre>
      </div>
    );
  }

  if (item.type === "exploring") {
    return (
      <div className="paradigm-exec-line">
        <Search size={12} className="paradigm-exec-icon" />
        <span>{item.label}</span>
        <ChevronDown size={12} className="paradigm-exec-chevron" />
      </div>
    );
  }

  if (item.type === "todo_update") {
    return (
      <div className="paradigm-exec-line">
        <ListTodo size={12} className="paradigm-exec-icon" />
        <span>
          {item.done ? t("chat.phase.todoUpdated") : t("chat.phase.todoUpdating")}
        </span>
      </div>
    );
  }

  if (item.type === "progress") {
    return (
      <div className="paradigm-exec-line">
        <ListTodo size={12} className="paradigm-exec-icon" />
        <span>{item.text}</span>
      </div>
    );
  }

  return (
    <div className="paradigm-exec-line">
      {item.done ? (
        <Check size={12} className="paradigm-exec-icon paradigm-exec-icon--done" />
      ) : (
        <Loader2 size={12} className="paradigm-exec-icon paradigm-exec-spin" />
      )}
      <span className="paradigm-exec-em">{item.name}</span>
      {item.detail && (
        <span className="paradigm-exec-detail">{item.detail}</span>
      )}
    </div>
  );
}

export const AgentTurnView = memo(function AgentTurnView({
  phases,
  isLive = false,
  toolProgress,
  toolProgressLog = [],
  liveSteps = [],
  todos = [],
  showThinkingPlaceholder = false,
  isLast = false,
  onApprove,
  onDeny,
  needsApproval = false,
  streamStall,
  onAbort,
}: AgentTurnViewProps): React.JSX.Element {
  const { t } = useI18n();
  const [thinkOpen, setThinkOpen] = useState(true);
  const [execOpen, setExecOpen] = useState(true);

  const reasoning = phases.reasoning.trim();
  const hasThinking = !!reasoning || (isLive && showThinkingPlaceholder);
  const hasExecution =
    isLive ||
    phases.execution.length > 0 ||
    liveSteps.length > 0 ||
    toolProgressLog.length > 0 ||
    !!toolProgress ||
    (isLive && todos.length > 0);

  const progressLines = useMemo(
    () =>
      toolProgressLog.length > 0
        ? toolProgressLog
        : toolProgress
          ? [toolProgress]
          : [],
    [toolProgress, toolProgressLog],
  );

  const liveExecution = useMemo((): ExecutionItem[] => {
    const items: ExecutionItem[] = [...phases.execution];
    for (const step of liveSteps) {
      if (items.some((x) => x.id === step.id)) continue;
      items.push({
        type: "tool",
        id: step.id,
        name: step.label,
        detail: step.detail,
        done: step.done ?? false,
      });
    }
    for (let i = 0; i < progressLines.length; i++) {
      items.push({
        type: "progress",
        id: `live-progress-${i}`,
        text: progressLines[i],
      });
    }
    return items;
  }, [phases.execution, liveSteps, progressLines]);

  const hasResult = !!phases.result.trim();
  const showProcessing = isLive && isLast && !hasResult;

  const elapsedLabel =
    isLive && streamStall && streamStall.elapsedSec > 0
      ? ` · ${streamStall.elapsedSec}s`
      : "";

  return (
    <section className="paradigm-agent-turn" aria-label={t("chat.phase.agentTurn")}>
      {isLive && streamStall?.stalled && onAbort && (
        <div className="paradigm-stall-banner" role="status">
          <p>{t("chat.phase.stallWarning", { seconds: streamStall.stallSec })}</p>
          <button type="button" className="paradigm-stall-cancel" onClick={onAbort}>
            {t("chat.phase.cancelRun")}
          </button>
        </div>
      )}
      {hasThinking && (
        <div className="paradigm-phase paradigm-phase--thinking">
          <button
            type="button"
            className="paradigm-phase-head"
            onClick={() => setThinkOpen((o) => !o)}
          >
            <Brain size={14} className="paradigm-phase-icon" />
            <span className="paradigm-phase-title">
              {t("chat.phase.deepThinking")}
              {elapsedLabel}
            </span>
            {isLive && !reasoning && (
              <Loader2 size={12} className="paradigm-exec-spin" />
            )}
            <ChevronDown
              size={14}
              className={`paradigm-phase-chevron ${thinkOpen ? "paradigm-phase-chevron--open" : ""}`}
            />
          </button>
          {thinkOpen && (
            <div className="paradigm-phase-body paradigm-phase-body--thinking">
              <ThinkingView
                text={reasoning}
                placeholder={
                  isLive && showThinkingPlaceholder
                    ? t("chat.agentThinkingPlaceholder")
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {hasExecution && (
        <div className="paradigm-phase paradigm-phase--execution">
          <button
            type="button"
            className="paradigm-phase-head"
            onClick={() => setExecOpen((o) => !o)}
          >
            <Terminal size={14} className="paradigm-phase-icon" />
            <span className="paradigm-phase-title">{t("chat.phase.execution")}</span>
            <ChevronDown
              size={14}
              className={`paradigm-phase-chevron ${execOpen ? "paradigm-phase-chevron--open" : ""}`}
            />
          </button>
          {execOpen && (
            <div className="paradigm-phase-body">
              {liveExecution.length === 0 && isLive && (
                <p className="agent-run-placeholder">{t("chat.phase.waitingExecution")}</p>
              )}
              {liveExecution.map((item) => (
                <ExecutionLine key={item.id} item={item} />
              ))}
              {isLive && todos.length > 0 && (
                <div className="paradigm-todos-inline">
                  <AgentTodoPanel items={todos} embedded />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(hasResult || showProcessing) && (
        <div className="paradigm-phase paradigm-phase--result">
          <div className="paradigm-phase-head paradigm-phase-head--static">
            <Sparkles size={14} className="paradigm-phase-icon" />
            <span className="paradigm-phase-title">{t("chat.phase.result")}</span>
            {showProcessing && (
              <span className="paradigm-processing">{t("chat.phase.processing")}</span>
            )}
          </div>
          <div className="paradigm-phase-body paradigm-phase-body--result">
            {hasResult ? (
              <AgentMarkdown variant="chat">{phases.result}</AgentMarkdown>
            ) : (
              <p className="agent-run-placeholder">{t("chat.phase.processing")}</p>
            )}
          </div>
        </div>
      )}

      {needsApproval && onApprove && onDeny && (
        <div className="chat-approval-bar">
          <button className="chat-approval-btn chat-approve" onClick={onApprove}>
            {t("chat.approve")}
          </button>
          <button className="chat-approval-btn chat-deny" onClick={onDeny}>
            {t("chat.deny")}
          </button>
        </div>
      )}
    </section>
  );
});
