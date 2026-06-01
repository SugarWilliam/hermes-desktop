/**
 * Usage tracking — persists token consumption and cost per chat turn
 * so the UsageDashboard can show daily/weekly/monthly trends.
 *
 * Data is stored in the profile's `desktop/usage.json` alongside the
 * session cache, NOT in state.db (which is owned by the gateway).
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  profileHome,
  getActiveProfileNameSync,
  safeWriteFile,
} from "./utils";

// ── Types ─────────────────────────────────────────────

export interface UsageRecord {
  /** ISO date string truncated to day (YYYY-MM-DD) */
  date: string;
  /** Unix timestamp (seconds) when the record was written */
  ts: number;
  sessionId: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface UsageStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  totalTurns: number;
  byModel: Record<
    string,
    { tokens: number; cost: number; turns: number }
  >;
  byProvider: Record<
    string,
    { tokens: number; cost: number; turns: number }
  >;
}

export interface UsageTrendPoint {
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
  turns: number;
}

// ── Storage ───────────────────────────────────────────

function usageFilePath(profile?: string): string {
  return join(
    profileHome(profile ?? getActiveProfileNameSync()),
    "desktop",
    "usage.json",
  );
}

function readUsageFile(profile?: string): UsageRecord[] {
  const file = usageFilePath(profile);
  try {
    if (!existsSync(file)) return [];
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeUsageFile(
  records: UsageRecord[],
  profile?: string,
): void {
  try {
    safeWriteFile(usageFilePath(profile), JSON.stringify(records));
  } catch {
    // non-fatal
  }
}

// ── Public API ────────────────────────────────────────

/** Record a single usage event from a chat turn. */
export function recordUsage(opts: {
  sessionId: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  profile?: string;
}): void {
  if (!opts.totalTokens && !opts.promptTokens && !opts.completionTokens) return;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const record: UsageRecord = {
    date: dateStr,
    ts: Math.floor(now.getTime() / 1000),
    sessionId: opts.sessionId,
    model: opts.model || "unknown",
    provider: opts.provider || "unknown",
    promptTokens: opts.promptTokens || 0,
    completionTokens: opts.completionTokens || 0,
    totalTokens: opts.totalTokens || 0,
    cost: opts.cost || 0,
  };
  const records = readUsageFile(opts.profile);
  records.push(record);
  // Cap at 50000 records (~months of heavy use)
  if (records.length > 50000) records.splice(0, records.length - 50000);
  writeUsageFile(records, opts.profile);
}

/** Get aggregated usage stats, optionally filtered by date range. */
export function getUsageStats(
  fromTs?: number,
  toTs?: number,
  profile?: string,
): UsageStats {
  let records = readUsageFile(profile);
  if (fromTs) records = records.filter((r) => r.ts >= fromTs);
  if (toTs) records = records.filter((r) => r.ts <= toTs);

  const stats: UsageStats = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    totalTurns: records.length,
    byModel: {},
    byProvider: {},
  };

  for (const r of records) {
    stats.totalPromptTokens += r.promptTokens;
    stats.totalCompletionTokens += r.completionTokens;
    stats.totalTokens += r.totalTokens;
    stats.totalCost += r.cost;

    if (!stats.byModel[r.model]) {
      stats.byModel[r.model] = { tokens: 0, cost: 0, turns: 0 };
    }
    stats.byModel[r.model].tokens += r.totalTokens;
    stats.byModel[r.model].cost += r.cost;
    stats.byModel[r.model].turns++;

    if (!stats.byProvider[r.provider]) {
      stats.byProvider[r.provider] = { tokens: 0, cost: 0, turns: 0 };
    }
    stats.byProvider[r.provider].tokens += r.totalTokens;
    stats.byProvider[r.provider].cost += r.cost;
    stats.byProvider[r.provider].turns++;
  }

  return stats;
}

/** Get daily usage trend for the last N days. */
export function getUsageTrend(
  days: number = 30,
  profile?: string,
): UsageTrendPoint[] {
  const records = readUsageFile(profile);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTs = Math.floor(cutoff.getTime() / 1000);

  const filtered = records.filter((r) => r.ts >= cutoffTs);

  // Group by date
  const byDate = new Map<
    string,
    { tokens: number; cost: number; turns: number }
  >();
  for (const r of filtered) {
    const existing = byDate.get(r.date);
    if (existing) {
      existing.tokens += r.totalTokens;
      existing.cost += r.cost;
      existing.turns++;
    } else {
      byDate.set(r.date, {
        tokens: r.totalTokens,
        cost: r.cost,
        turns: 1,
      });
    }
  }

  // Build complete date range (fill gaps with zeros)
  const points: UsageTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = byDate.get(dateStr) || { tokens: 0, cost: 0, turns: 0 };
    points.push({ date: dateStr, ...data });
  }

  return points;
}
