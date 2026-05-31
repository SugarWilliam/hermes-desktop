import { useMemo, memo } from "react";
import { Circle } from "lucide-react";
import { parsePlanToTodos } from "./planTodos";

interface PlanTodoViewProps {
  text: string;
  title?: string;
}

const PlanTodoView = memo(function PlanTodoView({
  text,
  title,
}: PlanTodoViewProps): React.JSX.Element {
  const sections = useMemo(() => parsePlanToTodos(text), [text]);

  if (sections.length === 0) return <></>;

  return (
    <div className="plan-todo-view">
      {title && <div className="plan-todo-title">{title}</div>}
      {sections.map((section, si) => (
        <div key={si} className="plan-todo-section">
          <div className="plan-todo-section-title">{section.title}</div>
          <ul className="plan-todo-list">
            {section.items.map((item) => (
              <li key={item.id} className="plan-todo-item">
                <Circle size={12} className="plan-todo-icon" />
                <span className="plan-todo-label">{item.content}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
});

export { PlanTodoView };
export default PlanTodoView;
