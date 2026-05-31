import { memo, useState, useMemo } from "react";
import { ChevronDown, Check, Loader2, Microscope } from "lucide-react";

// ── Types ─────────────────────────────────────────────

export interface RigorousPhase {
  name: string;
  label: string;
  status: "pending" | "active" | "completed";
  content: string;
  evidenceLevel?: "C1" | "C2" | "C3" | "C4";
}

export interface RigorousPipeline {
  phases: RigorousPhase[];
}

// ── Step icons ────────────────────────────────────────

const STEP_LABELS = [
  "Build Hypotheses",
  "Calibrate Models",
  "Select Adapters",
  "Couple Domains",
  "Perturb & Test",
  "Generate Report",
];

function defaultPhases(): RigorousPhase[] {
  return STEP_LABELS.map((label, i) => ({
    name: `step-${i + 1}`,
    label,
    status: "pending" as const,
    content: "",
  }));
}

// ── Component ─────────────────────────────────────────

interface RigorousPhaseViewProps {
  pipeline?: RigorousPipeline;
  text?: string; // fallback: raw reasoning text when pipeline info is unavailable
  isLive?: boolean;
}

export const RigorousPhaseView = memo(function RigorousPhaseView({
  pipeline,
  text,
  isLive = false,
}: RigorousPhaseViewProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const phases = useMemo(() => {
    if (pipeline?.phases?.length) return pipeline.phases;
    // If no structured pipeline, create fake phases from text content
    // This allows graceful degradation when the agent doesn't output structured data
    const defaults = defaultPhases();
    if (text && text.trim()) {
      // Mark the first phase as completed and inject the text as content
      defaults[0] = {
        ...defaults[0],
        status: "completed",
        content: text.slice(0, 300),
      };
    }
    return defaults;
  }, [pipeline, text]);

  const togglePhase = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const activePhaseIndex = useMemo(
    () => phases.findIndex((p) => p.status === "active"),
    [phases],
  );

  const completedCount = useMemo(
    () => phases.filter((p) => p.status === "completed").length,
    [phases],
  );

  return (
    <div className="rigorous-phase-view">
      {/* Progress summary */}
      <div className="rigorous-progress">
        <Microscope size={14} />
        <span className="rigorous-progress-text">
          Rigorous Pipeline: {completedCount}/{phases.length} steps
        </span>
        {isLive && activePhaseIndex >= 0 && (
          <span className="rigorous-progress-active">
            &middot; {phases[activePhaseIndex].label}
          </span>
        )}
        {isLive && (
          <Loader2 size={12} className="rigorous-spinner" />
        )}
      </div>

      {/* Phase list */}
      <div className="rigorous-phase-list">
        {phases.map((phase, i) => {
          const isActive = phase.status === "active";
          const isCompleted = phase.status === "completed";
          const hasContent = phase.content.trim().length > 0;
          const isOpen = expanded.has(phase.name) || isActive;

          return (
            <div
              key={phase.name}
              className={`rigorous-phase-item ${isActive ? "rigorous-phase-item--active" : ""} ${isCompleted ? "rigorous-phase-item--done" : ""}`}
            >
              <button
                type="button"
                className="rigorous-phase-head"
                onClick={() => {
                  if (hasContent || isActive) togglePhase(phase.name);
                }}
                disabled={!hasContent && !isActive}
                aria-expanded={isOpen}
              >
                <span className="rigorous-phase-step">
                  {i + 1}
                </span>
                <span className="rigorous-phase-label">
                  {phase.label}
                </span>
                <span className="rigorous-phase-status">
                  {isCompleted && <Check size={12} className="rigorous-check" />}
                  {isActive && <Loader2 size={12} className="rigorous-spinner" />}
                  {phase.evidenceLevel && (
                    <span className={`rigorous-evidence-tag rigorous-evidence--${phase.evidenceLevel.toLowerCase()}`}>
                      {phase.evidenceLevel}
                    </span>
                  )}
                </span>
                {(hasContent || isActive) && (
                  <ChevronDown
                    size={12}
                    className={`rigorous-chevron ${isOpen ? "rigorous-chevron--open" : ""}`}
                  />
                )}
              </button>
              {isOpen && hasContent && (
                <div className="rigorous-phase-body">
                  <div className="rigorous-phase-content">
                    {phase.content}
                  </div>
                </div>
              )}
              {isActive && !hasContent && (
                <div className="rigorous-phase-body rigorous-phase-body--pending">
                  <span className="rigorous-pending-label">
                    Processing...
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
