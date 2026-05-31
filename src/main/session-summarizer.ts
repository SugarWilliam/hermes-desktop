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
