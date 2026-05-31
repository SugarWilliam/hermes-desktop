import { memo } from "react";

// ── Types ─────────────────────────────────────────────

export type EvidenceLevel = "C1" | "C2" | "C3" | "C4";

interface EvidenceBadgeProps {
  level: EvidenceLevel;
}

const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  C1: "Strong Evidence",
  C2: "Moderate Evidence",
  C3: "Weak Evidence",
  C4: "Speculative",
};

// ── Component ─────────────────────────────────────────

export const EvidenceBadge = memo(function EvidenceBadge({
  level,
}: EvidenceBadgeProps): React.JSX.Element {
  return (
    <span
      className={`evidence-badge evidence-badge--${level.toLowerCase()}`}
      title={EVIDENCE_LABELS[level]}
    >
      {level}
    </span>
  );
});
