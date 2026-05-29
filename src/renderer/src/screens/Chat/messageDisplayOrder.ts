import type { ChatMessage } from "./types";

function isUserMessage(m: ChatMessage): boolean {
  if ("kind" in m && m.kind === "user") return true;
  return !("kind" in m) && m.role === "user";
}

function isAgentBubble(m: ChatMessage): boolean {
  return !("kind" in m) && m.role === "agent";
}

function orderAgentTurnSlice(turn: ChatMessage[]): ChatMessage[] {
  const reasoning = turn.filter((m) => m.kind === "reasoning");
  const toolCalls = turn.filter((m) => m.kind === "tool_call");
  const toolResults = turn.filter((m) => m.kind === "tool_result");
  const bubbles = turn.filter((m) => isAgentBubble(m));
  const used = new Set<ChatMessage>();
  for (const m of [...reasoning, ...toolCalls, ...toolResults, ...bubbles]) {
    used.add(m);
  }
  const other = turn.filter((m) => !used.has(m));

  const resultByCallId = new Map(
    toolResults.map((m) => [m.callId || m.id, m]),
  );
  const pairedResults = new Set<ChatMessage>();
  const toolOrdered: ChatMessage[] = [];
  for (const tc of toolCalls) {
    toolOrdered.push(tc);
    const tr = resultByCallId.get(tc.callId || tc.id);
    if (tr) {
      toolOrdered.push(tr);
      pairedResults.add(tr);
    }
  }
  for (const tr of toolResults) {
    if (!pairedResults.has(tr)) toolOrdered.push(tr);
  }

  return [...reasoning, ...toolOrdered, ...bubbles, ...other];
}

/**
 * Cursor-style ordering within each turn: thinking → tools → final answer.
 */
export function orderMessagesForDisplay(
  messages: ReadonlyArray<ChatMessage>,
): ChatMessage[] {
  const out: ChatMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (isUserMessage(m)) {
      out.push(m);
      i++;
      const turn: ChatMessage[] = [];
      while (i < messages.length && !isUserMessage(messages[i])) {
        turn.push(messages[i]);
        i++;
      }
      out.push(...orderAgentTurnSlice(turn));
    } else {
      out.push(m);
      i++;
    }
  }
  return out;
}
