import { memo } from "react";
import {
  CheckCircle,
  AlertTriangle,
  ListChecks,
  CheckSquare,
  ChevronRight,
  Circle,
  BadgeCheck,
  FileEdit,
  XCircle,
} from "lucide-react";
import { useI18n } from "./useI18n";

// ── Types (mirrored from plan-parser for renderer use) ─

export interface ParsedTask {
  id: string;
  content: string;
  subtasks: ParsedTask[];
  dependsOn: string[];
}

export interface ParsedPlan {
  title: string;
  goals: string[];
  tasks: ParsedTask[];
  risks: string[];
  verification: string;
}

// ── Types ─────────────────────────────────────────────

export type PlanStatus = "draft" | "approved" | "in_progress" | "implemented" | "rejected";

interface PlanCardProps {
  plan: ParsedPlan;
  status?: PlanStatus;
  onApprove?: () => void;
  onDeny?: () => void;
  onEdit?: () => void;
  onTaskToggle?: (taskId: string, checked: boolean) => void;
  checkedTasks?: Set<string>;
  readonly?: boolean;
}

// ── Status helpers ────────────────────────────────────

const STATUS_COLORS: Record<PlanStatus, { bg: string; text: string }> = {
  draft: { bg: "var(--bg-tertiary)", text: "var(--text-muted)" },
  approved: { bg: "var(--success-bg)", text: "var(--success)" },
  in_progress: { bg: "var(--accent-subtle)", text: "var(--accent-text)" },
  implemented: { bg: "var(--success-bg)", text: "var(--success)" },
  rejected: { bg: "var(--error-bg)", text: "var(--error)" },
};

function statusLabel(status: PlanStatus): string {
  // Map to raw English labels for use when i18n keys may not exist yet
  const labels: Record<PlanStatus, string> = {
    draft: "Draft",
    approved: "Approved",
    in_progress: "In Progress",
    implemented: "Implemented",
    rejected: "Rejected",
  };
  return labels[status] || status;
}

// ── Sub-components ────────────────────────────────────

interface StatusBadgeProps {
  status: PlanStatus;
}

const StatusBadge = memo(function StatusBadge({
  status,
}: StatusBadgeProps): React.JSX.Element {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.draft;

  return (
    <span
      className="plan-card-status-badge"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {statusLabel(status)}
    </span>
  );
});

interface TaskItemProps {
  task: ParsedTask;
  depth?: number;
  checkedTasks: Set<string>;
  readonly: boolean;
  onTaskToggle?: (taskId: string, checked: boolean) => void;
}

const TaskItem = memo(function TaskItem({
  task,
  depth = 0,
  checkedTasks,
  readonly,
  onTaskToggle,
}: TaskItemProps): React.JSX.Element {
  const isChecked = checkedTasks.has(task.id);

  const handleToggle = () => {
    if (readonly || !onTaskToggle) return;
    onTaskToggle(task.id, !isChecked);
  };

  return (
    <div className="plan-card-task-group">
      <div className="plan-card-task-item" style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          className={`plan-card-task-checkbox${isChecked ? " plan-card-task-checkbox--checked" : ""}`}
          onClick={handleToggle}
          type="button"
          disabled={readonly}
          aria-label={isChecked ? `Mark ${task.content} incomplete` : `Mark ${task.content} complete`}
        >
          {isChecked ? (
            <CheckSquare size={16} />
          ) : (
            <Circle size={16} />
          )}
        </button>
        <span
          className={`plan-card-task-content${isChecked ? " plan-card-task-content--done" : ""}`}
        >
          <span className="plan-card-task-id">[{task.id}]</span>{" "}
          {task.content}
        </span>
        {task.dependsOn.length > 0 && (
          <span className="plan-card-task-deps">
            depends on {task.dependsOn.join(", ")}
          </span>
        )}
      </div>
      {task.subtasks.map((sub) => (
        <TaskItem
          key={sub.id}
          task={sub}
          depth={depth + 1}
          checkedTasks={checkedTasks}
          readonly={readonly}
          onTaskToggle={onTaskToggle}
        />
      ))}
    </div>
  );
});

// ── Main Component ────────────────────────────────────

export const PlanCard = memo(function PlanCard({
  plan,
  status = "draft",
  onApprove,
  onDeny,
  onEdit,
  onTaskToggle,
  checkedTasks,
  readonly = false,
}: PlanCardProps): React.JSX.Element | null {
  const { t } = useI18n();

  const tasks = plan.tasks || [];
  const goals = plan.goals || [];
  const risks = plan.risks || [];
  const verification = plan.verification || "";
  const planTitle = plan.title || "Untitled Plan";

  const taskCheckedSet = checkedTasks || new Set<string>();

  const hasGoals = goals.length > 0;
  const hasTasks = tasks.length > 0;
  const hasRisks = risks.length > 0;
  const hasVerification = verification.length > 0;
  const hasAnySection = hasGoals || hasTasks || hasRisks || hasVerification;

  const showFooter =
    !readonly &&
    status === "draft" &&
    (onApprove || onDeny || onEdit);

  return (
    <div className="plan-card">
      {/* Header */}
      <div className="plan-card-header">
        <div className="plan-card-header-left">
          <ListChecks size={18} className="plan-card-header-icon" />
          <h3 className="plan-card-title">{planTitle}</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Content */}
      <div className="plan-card-body">
        {!hasAnySection && (
          <p className="plan-card-empty">{t("chat.agentTodosPlaceholder")}</p>
        )}

        {/* Goals */}
        {hasGoals && (
          <div className="plan-card-section">
            <div className="plan-card-section-header">
              <CheckCircle size={14} className="plan-card-section-icon" />
              <span className="plan-card-section-title">Goals</span>
            </div>
            <ul className="plan-card-list plan-card-list--goals">
              {goals.map((goal, i) => (
                <li key={i} className="plan-card-list-item">
                  <ChevronRight
                    size={12}
                    className="plan-card-list-bullet"
                  />
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tasks */}
        {hasTasks && (
          <div className="plan-card-section">
            <div className="plan-card-section-header">
              <CheckSquare size={14} className="plan-card-section-icon" />
              <span className="plan-card-section-title">{t("chat.planTasks")}</span>
            </div>
            <div className="plan-card-tasks">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  depth={0}
                  checkedTasks={taskCheckedSet}
                  readonly={readonly}
                  onTaskToggle={onTaskToggle}
                />
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {hasRisks && (
          <div className="plan-card-section">
            <div className="plan-card-section-header plan-card-section-header--warning">
              <AlertTriangle size={14} className="plan-card-section-icon" />
              <span className="plan-card-section-title">Risks</span>
            </div>
            <ul className="plan-card-list plan-card-list--risks">
              {risks.map((risk, i) => (
                <li key={i} className="plan-card-list-item plan-card-list-item--risk">
                  <AlertTriangle
                    size={12}
                    className="plan-card-list-bullet plan-card-list-bullet--warning"
                  />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Verification */}
        {hasVerification && (
          <div className="plan-card-section">
            <div className="plan-card-section-header">
              <BadgeCheck size={14} className="plan-card-section-icon" />
              <span className="plan-card-section-title">Verification</span>
            </div>
            <div className="plan-card-verification">{verification}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="plan-card-footer">
          {onEdit && (
            <button
              className="plan-card-btn plan-card-btn--edit"
              onClick={onEdit}
              type="button"
            >
              <FileEdit size={14} />
              <span>Edit</span>
            </button>
          )}
          {onDeny && (
            <button
              className="plan-card-btn plan-card-btn--deny"
              onClick={onDeny}
              type="button"
            >
              <XCircle size={14} />
              <span>{t("chat.deny")}</span>
            </button>
          )}
          {onApprove && (
            <button
              className="plan-card-btn plan-card-btn--approve"
              onClick={onApprove}
              type="button"
            >
              <CheckCircle size={14} />
              <span>{t("chat.approve")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default PlanCard;
