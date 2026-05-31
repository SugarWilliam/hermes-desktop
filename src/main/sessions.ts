import Database from "better-sqlite3";
import { existsSync } from "fs";
import { activeStateDbPath } from "./utils";
import type { Attachment } from "../shared/attachments";
import { isImageMime } from "../shared/attachments";
import { removeSessionFromCache } from "./session-cache";


// ── Cross-Session Context ─────────────────────────────

export interface RecentSessionContext {
  sessionId: string;
  title: string;
  startedAt: number;
  messageCount: number;
  preview: string;
}

/**
 * Find recent sessions from the same workspace/context.
 * Returns up to 3 most recent sessions with their summaries.
 */
export function getRecentSessions(limit = 3): RecentSessionContext[] {
  try {
    const dbPath = activeStateDbPath();
    if (!existsSync(dbPath)) return [];

    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare(
          "SELECT id, source, started_at, COALESCE(title, 'Untitled') as title, preview FROM sessions ORDER BY started_at DESC LIMIT ?"
        )
        .all(limit) as Array<{
        id: string;
        source: string;
        started_at: number;
        title: string;
        preview: string;
      }>;

      // Get message count for each session
      return rows.map((row) => {
        const countRow = db
          .prepare("SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?")
          .get(row.id) as { cnt: number } | undefined;
        return {
          sessionId: row.id,
          title: row.title,
          startedAt: row.started_at,
          messageCount: countRow?.cnt ?? 0,
          preview: row.preview || "",
        };
      });
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

/**
 * Build a context string from recent sessions for injection.
 */
export function getRecentSessionsContext(limit = 3): string | null {
  const recent = getRecentSessions(limit);
  if (recent.length === 0) return null;

  const lines = [
    "## Recent Session Context",
    "",
    "The following recent sessions may provide relevant context:",
    "",
  ];
  for (const s of recent) {
    const date = new Date(s.startedAt * 1000).toLocaleDateString();
    lines.push(
      `- **${s.title}** (${date}, ${s.messageCount} messages)`
    );
  }
  lines.push("");
  return lines.join("\n");
}

// Sentinel prefix used by hermes-agent's hermes_state.py to mark
// JSON-encoded multimodal content in the messages.content column.
// See agent source: hermes_state._CONTENT_JSON_PREFIX = "\x00json:".
const CONTENT_JSON_PREFIX = "\x00json:";

export interface SessionSummary {
  id: string;
  source: string;
  startedAt: number;
  endedAt: number | null;
  messageCount: number;
  model: string;
  title: string | null;
  preview: string;
}

export interface SessionMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

/**
 * Renderer-facing union of timeline items reconstructed from the DB.
 *
 * `user` / `assistant` are visible message bubbles. `reasoning`,
 * `tool_call`, and `tool_result` are surfaced as collapsible sub-rows
 * — they exist in the agent's state DB but were dropped on read until
 * this change. We emit them inline at the position they originally
 * occurred so the resumed transcript matches the live conversation.
 */
export type HistoryItem =
  | {
      kind: "user";
      id: number;
      content: string;
      timestamp: number;
      attachments?: Attachment[];
    }
  | {
      kind: "assistant";
      id: number;
      content: string;
      timestamp: number;
      attachments?: Attachment[];
    }
  | {
      kind: "reasoning";
      id: number;
      assistantId: number;
      text: string;
      timestamp: number;
    }
  | {
      kind: "tool_call";
      id: number;
      assistantId: number;
      callId: string;
      name: string;
      args: string; // pretty-printed JSON when possible, otherwise raw
      timestamp: number;
    }
  | {
      kind: "tool_result";
      id: number;
      callId: string;
      name: string;
      content: string;
      timestamp: number;
      attachments?: Attachment[];
    };

interface DecodedContent {
  text: string;
  attachments: Attachment[];
}

/**
 * Decode the agent's `messages.content` cell.  Plain strings are returned
 * verbatim; values with the agent's JSON-prefix sentinel are unpacked into
 * a text portion (concatenated `{type:"text"}` parts) plus an attachment
 * list (reconstituted from `{type:"image_url"}` parts).  Unknown or
 * malformed shapes fall through to the raw string.
 */
export function decodeContent(raw: string, messageId: number): DecodedContent {
  if (!raw || !raw.startsWith(CONTENT_JSON_PREFIX)) {
    return { text: raw || "", attachments: [] };
  }
  let parts: unknown;
  try {
    parts = JSON.parse(raw.slice(CONTENT_JSON_PREFIX.length));
  } catch {
    return { text: raw, attachments: [] };
  }
  if (!Array.isArray(parts)) {
    return { text: typeof parts === "string" ? parts : raw, attachments: [] };
  }

  const texts: string[] = [];
  const attachments: Attachment[] = [];
  let idx = 0;
  for (const p of parts) {
    if (typeof p === "string") {
      if (p) texts.push(p);
      continue;
    }
    if (!p || typeof p !== "object") continue;
    const type = String(
      (p as Record<string, unknown>).type || "",
    ).toLowerCase();
    if (type === "text" || type === "input_text" || type === "output_text") {
      const t = (p as Record<string, unknown>).text;
      if (typeof t === "string" && t) texts.push(t);
    } else if (type === "image_url" || type === "input_image") {
      const ref = (p as Record<string, unknown>).image_url;
      let url = "";
      if (typeof ref === "string") url = ref;
      else if (ref && typeof ref === "object") {
        const u = (ref as Record<string, unknown>).url;
        if (typeof u === "string") url = u;
      }
      if (!url || !url.startsWith("data:image/")) continue;
      const mime = url.slice("data:".length, url.indexOf(";"));
      attachments.push({
        id: `db-${messageId}-${idx++}`,
        kind: "image",
        name: `image.${guessExtension(mime)}`,
        mime: isImageMime(mime) ? mime : "image/png",
        size: 0,
        dataUrl: url,
      });
    }
  }
  return { text: texts.join("\n\n"), attachments };
}

function guessExtension(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export interface SearchResult {
  sessionId: string;
  title: string | null;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
  snippet: string;
}

function getDb(readonly = true): Database.Database | null {
  // Open the active profile's session DB — named profiles keep their
  // sessions under ~/.hermes/profiles/<name>/state.db (issue #311).
  const dbPath = activeStateDbPath();
  if (!existsSync(dbPath)) return null;
  return new Database(dbPath, readonly ? { readonly: true } : {});
}

export function listSessions(limit = 30, offset = 0): SessionSummary[] {
  const db = getDb();
  if (!db) return [];

  try {
    // Simple query without correlated subquery — titles come from session cache
    const rows = db
      .prepare(
        `SELECT
          s.id,
          s.source,
          s.started_at,
          s.ended_at,
          s.message_count,
          s.model,
          s.title
        FROM sessions s
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Array<{
      id: string;
      source: string;
      started_at: number;
      ended_at: number | null;
      message_count: number;
      model: string;
      title: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      messageCount: r.message_count,
      model: r.model || "",
      title: r.title,
      preview: "",
    }));
  } finally {
    db.close();
  }
}

export function searchSessions(query: string, limit = 20): SearchResult[] {
  const db = getDb();
  if (!db) return [];

  try {
    // Check if FTS table exists
    const tableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'",
      )
      .get() as { name: string } | undefined;

    if (!tableCheck) return [];

    // Sanitize query for FTS5: wrap each word with quotes for safety, add * for prefix
    const sanitized = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `"${w.replace(/"/g, "")}"*`)
      .join(" ");

    if (!sanitized) return [];

    const rows = db
      .prepare(
        `SELECT DISTINCT
          m.session_id,
          s.title,
          s.started_at,
          s.source,
          s.message_count,
          s.model,
          snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet
        FROM messages_fts
        JOIN messages m ON m.id = messages_fts.rowid
        JOIN sessions s ON s.id = m.session_id
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?`,
      )
      .all(sanitized, limit) as Array<{
      session_id: string;
      title: string | null;
      started_at: number;
      source: string;
      message_count: number;
      model: string;
      snippet: string;
    }>;

    return rows.map((r) => ({
      sessionId: r.session_id,
      title: r.title,
      startedAt: r.started_at,
      source: r.source,
      messageCount: r.message_count,
      model: r.model || "",
      snippet: r.snippet || "",
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/**
 * Try hard to extract human-readable reasoning text from one of the three
 * provider-specific columns the agent stores it in. Returns "" when nothing
 * usable is present.
 *
 * Priority: `reasoning` (plain text from most providers) >
 *           `reasoning_content` (legacy mirror) >
 *           `reasoning_details` (Anthropic / OpenRouter signed-block JSON;
 *            we flatten its `text` fields when present, otherwise drop it).
 */
export function pickReasoning(row: {
  reasoning: string | null;
  reasoning_content: string | null;
  reasoning_details: string | null;
}): string {
  const direct = (row.reasoning || "").trim();
  if (direct) return direct;
  const legacy = (row.reasoning_content || "").trim();
  if (legacy) return legacy;
  const details = (row.reasoning_details || "").trim();
  if (!details) return "";
  try {
    const parsed = JSON.parse(details);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      const texts: string[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.text === "string" && e.text) texts.push(e.text);
        else if (typeof e.thinking === "string" && e.thinking)
          texts.push(e.thinking);
      }
      if (texts.length) return texts.join("\n\n");
    }
  } catch {
    /* fall through */
  }
  return "";
}

/**
 * Parse the assistant row's `tool_calls` JSON. Each entry from the agent
 * looks like `{id, call_id, type:"function", function:{name, arguments}}`.
 * `arguments` is itself a JSON-encoded string the agent sent to the model.
 * We pretty-print it for display when it parses, leave it raw otherwise.
 *
 * Returns `[]` on any parse failure — the caller silently skips bad rows
 * so a malformed tool_calls cell never blocks history rendering.
 */
export function parseToolCalls(
  raw: string | null,
): Array<{ callId: string; name: string; args: string }> {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Array<{ callId: string; name: string; args: string }> = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const fn = (e.function || {}) as Record<string, unknown>;
    const name = typeof fn.name === "string" ? fn.name : "";
    if (!name) continue;
    const callId =
      (typeof e.call_id === "string" && e.call_id) ||
      (typeof e.id === "string" && e.id) ||
      "";
    const rawArgs = typeof fn.arguments === "string" ? fn.arguments : "";
    let args = rawArgs;
    try {
      args = JSON.stringify(JSON.parse(rawArgs), null, 2);
    } catch {
      // arguments wasn't JSON — leave as-is
    }
    out.push({ callId, name, args });
  }
  return out;
}

/**
 * Row shape as returned by the widened SELECT inside getSessionMessages,
 * exported so the unit tests can build fixture rows without going through
 * sqlite (better-sqlite3 is an Electron-only native module).
 */
export interface RawMessageRow {
  id: number;
  role: string;
  content: string | null;
  timestamp: number;
  tool_call_id: string | null;
  tool_calls: string | null;
  tool_name: string | null;
  reasoning: string | null;
  reasoning_content: string | null;
  reasoning_details: string | null;
}

/**
 * Pure expansion of DB rows → renderer-facing HistoryItem list. Kept pure
 * (no I/O) so we can exercise the ordering and edge-case logic directly
 * without booting sqlite.
 */
export function expandRowsToHistory(rows: RawMessageRow[]): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const r of rows) {
    const decoded = decodeContent(r.content || "", r.id);

    if (r.role === "user") {
      if (!decoded.text && decoded.attachments.length === 0) continue;
      items.push({
        kind: "user",
        id: r.id,
        content: decoded.text,
        timestamp: r.timestamp,
        ...(decoded.attachments.length > 0
          ? { attachments: decoded.attachments }
          : {}),
      });
      continue;
    }

    if (r.role === "assistant") {
      const reasoningText = pickReasoning(r);
      if (reasoningText) {
        items.push({
          kind: "reasoning",
          id: r.id,
          assistantId: r.id,
          text: reasoningText,
          timestamp: r.timestamp,
        });
      }

      for (const tc of parseToolCalls(r.tool_calls)) {
        items.push({
          kind: "tool_call",
          id: r.id,
          assistantId: r.id,
          callId: tc.callId,
          name: tc.name,
          args: tc.args,
          timestamp: r.timestamp,
        });
      }

      if (decoded.text || decoded.attachments.length > 0) {
        items.push({
          kind: "assistant",
          id: r.id,
          content: decoded.text,
          timestamp: r.timestamp,
          ...(decoded.attachments.length > 0
            ? { attachments: decoded.attachments }
            : {}),
        });
      }

      continue;
    }

    if (r.role === "tool") {
      const name = r.tool_name || "tool";
      items.push({
        kind: "tool_result",
        id: r.id,
        callId: r.tool_call_id || "",
        name,
        content: decoded.text,
        timestamp: r.timestamp,
        ...(decoded.attachments.length > 0
          ? { attachments: decoded.attachments }
          : {}),
      });
      continue;
    }
  }
  return items;
}

export function getSessionMessages(sessionId: string): HistoryItem[] {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = db
      .prepare(
        `SELECT id, role, content, timestamp,
                tool_call_id, tool_calls, tool_name,
                reasoning, reasoning_content, reasoning_details
         FROM messages
         WHERE session_id = ? AND role IN ('user', 'assistant', 'tool')
         ORDER BY timestamp, id`,
      )
      .all(sessionId) as RawMessageRow[];

    return expandRowsToHistory(rows);
  } finally {
    db.close();
  }
}

export function deleteSession(sessionId: string): void {
  const db = getDb(false);
  if (!db) return;

  try {
    const tx = db.transaction((id: string) => {
      db.prepare("DELETE FROM messages WHERE session_id = ?").run(id);
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    });
    tx(sessionId);
  } finally {
    db.close();
  }

  removeSessionFromCache(sessionId);
}

export interface SessionExportData {
  id: string;
  title: string;
  source: string;
  startedAt: number;
  model: string;
  messageCount: number;
  messages: HistoryItem[];
}

export function getSessionExportData(
  sessionId: string,
): SessionExportData | null {
  const db = getDb();
  if (!db) return null;

  try {
    const session = db
      .prepare(
        "SELECT id, source, started_at, message_count, model, title FROM sessions WHERE id = ?",
      )
      .get(sessionId) as
      | {
          id: string;
          source: string;
          started_at: number;
          message_count: number;
          model: string;
          title: string | null;
        }
      | undefined;

    if (!session) return null;

    const messages = getSessionMessages(sessionId);

    return {
      id: session.id,
      title: session.title || "Untitled",
      source: session.source,
      startedAt: session.started_at,
      model: session.model || "unknown",
      messageCount: session.message_count,
      messages,
    };
  } finally {
    db.close();
  }
}

export function exportSessionAsMarkdown(sessionId: string): string | null {
  const data = getSessionExportData(sessionId);
  if (!data) return null;

  const date = new Date(data.startedAt * 1000).toLocaleString();
  const lines: string[] = [];

  lines.push("# " + data.title);
  lines.push("");
  lines.push("**Date**: " + date);
  lines.push("**Model**: " + data.model);
  lines.push("**Messages**: " + data.messageCount);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of data.messages) {
    switch (msg.kind) {
      case "user":
        lines.push("## User");
        lines.push("");
        lines.push(msg.content);
        lines.push("");
        break;
      case "assistant":
        lines.push("## Agent");
        lines.push("");
        lines.push(msg.content);
        lines.push("");
        break;
      case "reasoning":
        lines.push("> **Reasoning**");
        lines.push(">");
        lines.push("> " + msg.text.replace(/\n/g, "\n> "));
        lines.push("");
        break;
      case "tool_call":
        lines.push("### Tool: " + msg.name);
        lines.push("");
        lines.push("```json");
        lines.push(msg.args);
        lines.push("```");
        lines.push("");
        break;
      case "tool_result":
        {
          lines.push("### Result: " + msg.name);
          lines.push("");
          const resultContent =
            msg.content.length > 5000
              ? msg.content.slice(0, 5000) + "\n\n... (truncated)"
              : msg.content;
          lines.push("```");
          lines.push(resultContent);
          lines.push("```");
          lines.push("");
          break;
        }
        break;
    }
  }

  return lines.join("\n");
}

export function exportSessionAsJson(sessionId: string): string | null {
  const data = getSessionExportData(sessionId);
  if (!data) return null;

  const output = {
    id: data.id,
    title: data.title,
    source: data.source,
    startedAt: data.startedAt,
    model: data.model,
    messageCount: data.messageCount,
    messages: data.messages.map((msg) => {
      const base = {
        kind: msg.kind,
        timestamp: msg.timestamp,
      };
      switch (msg.kind) {
        case "user":
          return {
            ...base,
            content: msg.content,
            attachments: msg.attachments,
          };
        case "assistant":
          return {
            ...base,
            content: msg.content,
            attachments: msg.attachments,
          };
        case "reasoning":
          return { ...base, text: msg.text };
        case "tool_call":
          return {
            ...base,
            name: msg.name,
            callId: msg.callId,
            args: msg.args,
          };
        case "tool_result":
          return {
            ...base,
            name: msg.name,
            callId: msg.callId,
            content: msg.content,
          };
      }
    }),
  };

  return JSON.stringify(output, null, 2);
}
