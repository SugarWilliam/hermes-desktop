import { describe, it, expect } from "vitest";
import {
  buildAgentHistoryPayload,
  isErrorBubble,
} from "../src/renderer/src/screens/Chat/sessionHistory";
import type { ChatMessage } from "../src/renderer/src/screens/Chat/types";

describe("buildAgentHistoryPayload", () => {
  it("includes user and agent bubbles only", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "plan this" },
      { id: "r1", kind: "reasoning", role: "agent", text: "thinking…" },
      { id: "a1", role: "agent", content: "Here is the plan" },
      {
        id: "tc1",
        kind: "tool_call",
        role: "agent",
        callId: "c1",
        name: "read",
        args: "{}",
      },
    ];

    expect(buildAgentHistoryPayload(messages)).toEqual([
      { role: "user", content: "plan this" },
      { role: "agent", content: "Here is the plan" },
    ]);
  });

  it("excludes renderer error bubbles from forwarded history", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "continue" },
      {
        id: "error-1",
        role: "agent",
        content: "Error: Codex stream produced no bytes within 12s",
      },
    ];

    expect(isErrorBubble(messages[1]!)).toBe(true);
    expect(buildAgentHistoryPayload(messages)).toEqual([
      { role: "user", content: "continue" },
    ]);
  });
});
