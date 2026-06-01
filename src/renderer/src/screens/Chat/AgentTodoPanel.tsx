import { memo, useState } from "react";
import { CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import type { AgentTodoItem, AgentTodoStatus } from "./agentTodos";

function StatusIcon({ status }: { status: AgentTodoStatus }): React.JSX.Element {
  const size = 14;
  switch (status) {
    case "completed":
      return <CheckCircle2 size={size} className="agent-todo-icon--done" />;
    case "in_progress":
      return <CircleDashed size={size} className="agent-todo-icon--active" />;
    case "cancelled":
      return <XCircle size={size} className="agent-todo-icon--cancelled" />;
    default:
      return <Circle size={size} className="agent-todo-icon--pending" />;
  }
}

export const AgentTodoPanel = memo(function AgentTodoPanel({
  items,
  embedded = false,
}: {
  items: AgentTodoItem[];
  /** Render without outer message chrome (inside AgentRunPanel). */
  embedded?: boolean;
}): React.JSX.Element | null {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const completed = items.filter((i) => i.status === "completed").length;
  const panelClass = [
    "agent-todo-panel",
    embedded ? "agent-todo-panel--embedded" : "",
    embedded && expanded ? "agent-todo-panel--expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const list = (
    <ul className="agent-todo-list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`agent-todo-item agent-todo-item--${item.status}`}
          role="listitem"
        >
          <StatusIcon status={item.status} />
          <span className="agent-todo-text">{item.content}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={panelClass} role="list" aria-label={t("chat.agentTodosTitle")}>
      {!embedded && (
        <div className="agent-todo-panel-header">{t("chat.agentTodosTitle")}</div>
      )}
      {embedded ? (
        <>
          {expanded ? list : null}
          <button
            type="button"
            className="agent-todo-panel-footer"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="agent-todo-panel-footer-label">
              {expanded ? "∨" : ">"} {t("chat.agentTodosBar")}
            </span>
            <span className="agent-todo-panel-footer-meta">
              {t("chat.agentTodosDone", {
                done: completed,
                total: items.length,
              })}
            </span>
          </button>
        </>
      ) : (
        list
      )}
    </div>
  );
});
