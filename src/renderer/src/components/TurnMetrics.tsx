import { memo } from "react";

// ── Types ─────────────────────────────────────────────

export interface TurnMetricsData {
  tokens?: number;
  elapsedMs?: number;
  phaseBreakdown?: {
    thinking: number;
    execution: number;
    result: number;
  };
}

interface TurnMetricsProps {
  metrics?: TurnMetricsData;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Component ─────────────────────────────────────────

export const TurnMetrics = memo(function TurnMetrics({
  metrics,
  compact = false,
}: TurnMetricsProps): React.JSX.Element | null {
  if (!metrics) return null;

  const { tokens, elapsedMs, phaseBreakdown } = metrics;
  const hasData = tokens !== undefined || elapsedMs !== undefined || phaseBreakdown !== undefined;

  if (!hasData) return null;

  return (
    <span className={`turn-metrics ${compact ? "turn-metrics--compact" : ""}`}>
      {elapsedMs !== undefined && (
        <span className="turn-metrics-item turn-metrics-elapsed">
          {formatDuration(elapsedMs)}
        </span>
      )}
      {tokens !== undefined && (
        <span className="turn-metrics-item turn-metrics-tokens">
          {formatTokens(tokens)} tok
        </span>
      )}
      {phaseBreakdown && (
        <span className="turn-metrics-item turn-metrics-breakdown">
          <span className="turn-metrics-phase-bar">
            {phaseBreakdown.thinking > 0 && (
              <span
                className="turn-metrics-bar turn-metrics-bar--think"
                style={{
                  flex: phaseBreakdown.thinking,
                }}
                title={`Thinking: ${formatDuration(phaseBreakdown.thinking)}`}
              />
            )}
            {phaseBreakdown.execution > 0 && (
              <span
                className="turn-metrics-bar turn-metrics-bar--exec"
                style={{
                  flex: phaseBreakdown.execution,
                }}
                title={`Execution: ${formatDuration(phaseBreakdown.execution)}`}
              />
            )}
            {phaseBreakdown.result > 0 && (
              <span
                className="turn-metrics-bar turn-metrics-bar--result"
                style={{
                  flex: phaseBreakdown.result,
                }}
                title={`Result: ${formatDuration(phaseBreakdown.result)}`}
              />
            )}
          </span>
        </span>
      )}
    </span>
  );
});
