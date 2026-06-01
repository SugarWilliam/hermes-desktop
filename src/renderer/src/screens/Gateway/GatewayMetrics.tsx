import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface MetricsData {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  uptime: number;
  platformStats: Record<string, { requests: number; errors: number }>;
  recentRequests: Array<{ timestamp: number; path: string; status: number; latencyMs: number }>;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function GatewayMetrics({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.hermesAPI.getGatewayMetrics(profile);
      setMetrics(data);
      if (!data) setError(t("gateway.metricsUnavailable"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [profile, t]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const errorRate = metrics && metrics.totalRequests > 0
    ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(1)
    : "0.0";

  const platformEntries = metrics ? Object.entries(metrics.platformStats) : [];
  const maxPlatformReqs = platformEntries.reduce(
    (max, [, s]) => Math.max(max, s.requests),
    0,
  );

  return (
    <div className="gw-metrics">
      <div className="gw-metrics-header">
        <Activity size={14} />
        <span>{t("gateway.metricsTitle")}</span>
        <button
          className="btn-ghost gw-metrics-refresh"
          onClick={loadMetrics}
          disabled={loading}
          type="button"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {error && <div className="gw-metrics-error">{error}</div>}

      {metrics && (
        <>
          <div className="gw-metrics-grid">
            <div className="gw-metric-card">
              <div className="gw-metric-value">{metrics.totalRequests}</div>
              <div className="gw-metric-label">{t("gateway.totalRequests")}</div>
            </div>
            <div className="gw-metric-card">
              <div className="gw-metric-value">{metrics.totalErrors}</div>
              <div className="gw-metric-label">{t("gateway.totalErrors")}</div>
            </div>
            <div className="gw-metric-card">
              <div className="gw-metric-value">{errorRate}%</div>
              <div className="gw-metric-label">{t("gateway.errorRate")}</div>
            </div>
            <div className="gw-metric-card">
              <div className="gw-metric-value">{metrics.avgLatencyMs.toFixed(0)}ms</div>
              <div className="gw-metric-label">{t("gateway.avgLatency")}</div>
            </div>
            <div className="gw-metric-card">
              <div className="gw-metric-value">{formatUptime(metrics.uptime)}</div>
              <div className="gw-metric-label">{t("gateway.uptime")}</div>
            </div>
          </div>

          {platformEntries.length > 0 && (
            <div className="gw-metrics-section">
              <div className="gw-metrics-section-title">{t("gateway.platformStats")}</div>
              <div className="gw-platform-bars">
                {platformEntries.map(([name, stats]) => (
                  <div key={name} className="gw-platform-bar-row">
                    <span className="gw-platform-name">{name}</span>
                    <div className="gw-platform-bar-track">
                      <div
                        className="gw-platform-bar-fill"
                        style={{
                          width: maxPlatformReqs > 0
                            ? `${(stats.requests / maxPlatformReqs) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                    <span className="gw-platform-count">
                      {stats.requests}
                      {stats.errors > 0 && (
                        <span className="gw-platform-errors"> ({stats.errors} err)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.recentRequests.length > 0 && (
            <div className="gw-metrics-section">
              <div className="gw-metrics-section-title">{t("gateway.recentRequests")}</div>
              <div className="gw-recent-list">
                {metrics.recentRequests.map((req, i) => (
                  <div key={i} className="gw-recent-row">
                    <span className={`gw-recent-status ${req.status >= 400 ? "error" : "ok"}`}>
                      {req.status}
                    </span>
                    <span className="gw-recent-path">{req.path}</span>
                    <span className="gw-recent-latency">{req.latencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
