import http from "http";
import https from "https";

/** Summary of a session suitable for memory storage. */
export interface SessionDigest {
  sessionId: string;
  title: string;
  startedAt: number;
  messageCount: number;
  /** Key topics extracted from the conversation. */
  keyTopics: string[];
  /** Compressed summary of the full conversation. */
  summary: string;
}

/** Result of an LLM-generated summary. */
export interface LlmSummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
}

/** Thresholds for suggesting automatic summarization. */
export interface SummarizationTriggers {
  messageCount: number;
  inactiveDays: number;
}

const DEFAULT_TRIGGERS: SummarizationTriggers = {
  messageCount: 40,
  inactiveDays: 5,
};

/**
 * Check if a session should be suggested for summarization.
 * Returns the reason string or null.
 */
export function shouldSuggestSummarization(
  _sessionId: string,
  messageCount: number,
  lastActivityTime: number,
  triggers: SummarizationTriggers = DEFAULT_TRIGGERS,
): string | null {
  if (messageCount >= triggers.messageCount) {
    return `Session has ${messageCount} messages (threshold: ${triggers.messageCount})`;
  }
  const inactiveMs = Date.now() - lastActivityTime * 1000;
  const inactiveDays = inactiveMs / (1000 * 60 * 60 * 24);
  if (inactiveDays >= triggers.inactiveDays) {
    return `Session inactive for ${inactiveDays.toFixed(1)} days (threshold: ${triggers.inactiveDays})`;
  }
  return null;
}

/**
 * Generate a concise digest of a session for memory storage.
 * Extracts first/last messages and key phrases.
 */
export function generateSessionDigest(
  sessionId: string,
  title: string,
  startedAt: number,
  messageCount: number,
  messages: Array<{ role: string; content: string }>,
): SessionDigest {
  // Extract key topics from user messages
  const userMessages = messages.filter((m) => m.role === "user");
  const keyTopics = extractKeyTopics(userMessages.map((m) => m.content));

  // Build summary from first + last user messages + stats
  const firstMsgs = userMessages.slice(0, 2).map((m) => m.content.slice(0, 200));
  const lastMsgs = userMessages.slice(-2).map((m) => m.content.slice(0, 200));
  
  const summary = [
    `**${title || "Untitled"}** — ${messageCount} messages, started ${new Date(startedAt * 1000).toLocaleDateString()}`,
    keyTopics.length > 0 ? `**Topics**: ${keyTopics.join(", ")}` : "",
    firstMsgs.length > 0 ? `**Started with**: "${firstMsgs[0]}"` : "",
    lastMsgs.length > 0 ? `**Last query**: "${lastMsgs[lastMsgs.length - 1]}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sessionId,
    title: title || "Untitled",
    startedAt,
    messageCount,
    keyTopics,
    summary,
  };
}

/** Simple keyword extraction from messages. */
function extractKeyTopics(messages: string[]): string[] {
  const techKeywords = [
    "React", "TypeScript", "Electron", "Node.js", "API",
    "bug", "fix", "feature", "refactor", "deploy",
    "test", "build", "config", "database", "performance",
    "security", "auth", "UI", "CSS", "component",
    "SSE", "IPC", "SQLite", "Monaco", "Markdown",
    "Mermaid", "Virtuoso", "Agent", "LLM", "RAG",
  ];
  
  const topicCount = new Map<string, number>();
  const allText = messages.join(" ").toLowerCase();
  
  for (const kw of techKeywords) {
    const lower = kw.toLowerCase();
    const count = (allText.match(new RegExp("\\b" + lower + "\\b", "gi")) || []).length;
    if (count > 0) topicCount.set(kw, count);
  }
  
  return Array.from(topicCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
}

/**
 * Build a memory entry string from a session digest.
 */
export function digestToMemoryEntry(digest: SessionDigest): string {
  const date = new Date(digest.startedAt * 1000).toISOString().split("T")[0];
  return [
    `[category: session-summary]`,
    `[priority: medium]`,
    `[session: ${digest.sessionId}]`,
    `[date: ${date}]`,
    "",
    digest.summary,
  ].join("\n");
}

// ── LLM-driven Summary ──────────────────────────────

/**
 * Generate a structured summary of a session by sending the conversation
 * history to the configured LLM. Returns the LLM-generated summary text.
 */
export async function generateLlmSummary(
  messages: Array<{ role: string; content: string }>,
  /** Injected from main process to avoid circular imports */
  deps: {
    getApiUrl: () => string;
    getApiHealthHeaders: (profile?: string) => Record<string, string>;
    getModelConfig: (profile?: string) => { model: string; provider?: string };
    profile?: string;
  },
): Promise<LlmSummaryResult> {
  // Truncate messages to fit context window (keep first 20 + last 10)
  const truncated =
    messages.length > 30
      ? [
          ...messages.slice(0, 20),
          { role: "system", content: "[... middle messages truncated for summarization ...]" },
          ...messages.slice(-10),
        ]
      : messages;

  const conversationText = truncated
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const systemPrompt =
    "You are a helpful assistant that generates concise, structured summaries of conversations. " +
    "Summarize the key topics, decisions, and outcomes. Use bullet points. Keep it under 300 words.";

  const userPrompt = `Please summarize the following conversation:\n\n${conversationText}`;

  const { model } = deps.getModelConfig(deps.profile);
  const baseUrl = deps.getApiUrl();
  const headers = deps.getApiHealthHeaders(deps.profile);
  const chatUrl = `${baseUrl}/v1/chat/completions`;

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const body = JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        max_tokens: 1024,
      });

      const mod = chatUrl.startsWith("https") ? https : http;

      const req = mod.request(
        chatUrl,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 30000,
        },
        (res) => {
          let data = "";
          res.on("data", (d: Buffer) => { data += d.toString(); });
          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(new Error(`API error ${res.statusCode}: ${data.slice(0, 200)}`));
              return;
            }
            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.message?.content;
              if (text) resolve(text);
              else reject(new Error("No content in LLM response"));
            } catch {
              reject(new Error(`Failed to parse LLM response: ${data.slice(0, 200)}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("LLM summary request timed out")); });
      req.write(body);
      req.end();
    });

    return { success: true, summary: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
