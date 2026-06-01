import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";

interface UsageStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  totalTurns: number;
  byModel: Record<string, { tokens: number; cost: number; turns: number }>;
  byProvider: Record<string, { tokens: number; cost: number; turns: number }>;
}

interface TrendPoint {
  date: string;
  tokens: number;
  cost: number;
  turns: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatCost(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

type Period = 7 | 30 | 90;

function UsageDashboard({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [period, setPeriod] = useState<Period>(30);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"model" | "provider">("model");

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const now = Date.now();
      const fromTs = Math.floor((now - period * 86400000) / 1000);
      const [s, tr] = await Promise.all([
        window.hermesAPI.getUsageStats(fromTs, undefined, profile),
        window.hermesAPI.getUsageTrend(period, profile),
      ]);
      setStats(s);
      setTrend(tr);
    } catch {
      // non-fatal
    }
    setLoading(false);
  }, [period, profile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Bar chart calculations
  const maxTokens = Math.max(...trend.map((p) => p.tokens), 1);

  return (
    <div className="usage-dashboard">
      {/* Period selector */}
      <div className="usage-period-bar">
        {([7, 30, 90] as Period[]).map((d) => (
          <button
            key={d}
            className={`usage-period-btn ${period === d ? "active" : ""}`}
            onClick={() => setPeriod(d)}
          >
            {d === 7
              ? t("settings.usage.period7d")
              : d === 30
                ? t("settings.usage.period30d")
                : t("settings.usage.period90d")}
          </button>
        ))}
        <button className="usage-period-btn usage-refresh-btn" onClick={loadData}>
          {t("settings.refresh")}
        </button>
      </div>

      {loading && !stats ? (
        <div className="usage-loading">
          <span className="skeleton skeleton-md" />
        </div>
      ) : !stats || stats.totalTurns === 0 ? (
        <div className="usage-empty">{t("settings.usage.empty")}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="usage-summary-cards">
            <div className="usage-card">
              <div className="usage-card-value">{formatNumber(stats.totalTokens)}</div>
              <div className="usage-card-label">{t("settings.usage.totalTokens")}</div>
            </div>
            <div className="usage-card">
              <div className="usage-card-value">{formatCost(stats.totalCost)}</div>
              <div className="usage-card-label">{t("settings.usage.totalCost")}</div>
            </div>
            <div className="usage-card">
              <div className="usage-card-value">{stats.totalTurns}</div>
              <div className="usage-card-label">{t("settings.usage.totalTurns")}</div>
            </div>
            <div className="usage-card">
              <div className="usage-card-value">
                {formatNumber(stats.totalPromptTokens)}
              </div>
              <div className="usage-card-label">{t("settings.usage.promptTokens")}</div>
            </div>
            <div className="usage-card">
              <div className="usage-card-value">
                {formatNumber(stats.totalCompletionTokens)}
              </div>
              <div className="usage-card-label">{t("settings.usage.completionTokens")}</div>
            </div>
          </div>

          {/* Trend chart */}
          <div className="usage-section">
            <div className="usage-section-title">
              {t("settings.usage.trendTitle")}
            </div>
            <div className="usage-chart">
              {trend.map((point) => {
                const height = maxTokens > 0 ? (point.tokens / maxTokens) * 100 : 0;
                return (
                  <div key={point.date} className="usage-chart-bar-wrap">
                    <div
                      className="usage-chart-bar"
                      style={{ height: `${height}%` }}
                      title={`${point.date}: ${formatNumber(point.tokens)} tokens, ${formatCost(point.cost)}, ${point.turns} turns`}
                    />
                    <span className="usage-chart-date">
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By model / provider table */}
          <div className="usage-section">
            <div className="usage-section-title">
              <span>{t("settings.usage.breakdown")}</span>
              <div className="usage-view-toggle">
                <button
                  className={`usage-period-btn ${view === "model" ? "active" : ""}`}
                  onClick={() => setView("model")}
                >
                  {t("settings.usage.byModel")}
                </button>
                <button
                  className={`usage-period-btn ${view === "provider" ? "active" : ""}`}
                  onClick={() => setView("provider")}
                >
                  {t("settings.usage.byProvider")}
                </button>
              </div>
            </div>
            <table className="usage-table">
              <thead>
                <tr>
                  <th>{view === "model" ? t("settings.usage.colModel") : t("settings.usage.colProvider")}</th>
                  <th className="usage-num">{t("settings.usage.colTurns")}</th>
                  <th className="usage-num">{t("settings.usage.colTokens")}</th>
                  <th className="usage-num">{t("settings.usage.colCost")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(view === "model" ? stats.byModel : stats.byProvider)
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([name, data]) => (
                    <tr key={name}>
                      <td className="usage-name-cell">{name}</td>
                      <td className="usage-num">{data.turns}</td>
                      <td className="usage-num">{formatNumber(data.tokens)}</td>
                      <td className="usage-num">{formatCost(data.cost)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default UsageDashboard;
