import { memo } from "react";
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
  if (items.length === 0) return null;

  return (
    <div
      className={`agent-todo-panel ${embedded ? "agent-todo-panel--embedded" : ""}`}
      role="list"
      aria-label={t("chat.agentTodosTitle")}
    >
      {!embedded && (
        <div className="agent-todo-panel-header">{t("chat.agentTodosTitle")}</div>
      )}
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
    </div>
  );
});
