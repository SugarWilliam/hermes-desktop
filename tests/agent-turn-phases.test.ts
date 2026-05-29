import { describe, expect, it } from "vitest";
import {
  buildAgentTurnPhases,
  splitMessagesIntoTurns,
} from "../src/renderer/src/screens/Chat/agentTurnPhases";
import type { ChatMessage } from "../src/renderer/src/screens/Chat/types";

describe("buildAgentTurnPhases", () => {
  it("merges reasoning and separates result", () => {
    const turn: ChatMessage[] = [
      {
        id: "r1",
        kind: "reasoning",
        role: "agent",
        text: "Plan A",
      },
      {
        id: "tc1",
        kind: "tool_call",
        role: "agent",
        name: "read_file",
        args: '{"path":"docs/methodology.md"}',
        callId: "c1",
      },
      {
        id: "tr1",
        kind: "tool_result",
        role: "agent",
        name: "read_file",
        result: "ok",
        callId: "c1",
      },
      {
        id: "a1",
        role: "agent",
        content: "## 综合评定\n\nB级",
      },
    ];
    const phases = buildAgentTurnPhases(turn);
    expect(phases.reasoning).toBe("Plan A");
    expect(phases.execution.some((e) => e.type === "viewed")).toBe(true);
    expect(phases.result).toContain("综合评定");
  });

  it("classifies shell as terminal", () => {
    const turn: ChatMessage[] = [
      {
        id: "tc1",
        kind: "tool_call",
        role: "agent",
        name: "run_terminal_cmd",
        args: '{"command":"npm test"}',
        callId: "c1",
      },
    ];
    const phases = buildAgentTurnPhases(turn);
    const term = phases.execution.find((e) => e.type === "terminal");
    expect(term).toBeDefined();
    if (term?.type === "terminal") {
      expect(term.command).toContain("npm test");
      expect(term.running).toBe(true);
    }
  });
});

describe("splitMessagesIntoTurns", () => {
  it("groups user then agent messages", () => {
    const msgs: ChatMessage[] = [
      { id: "u1", role: "user", content: "hi" },
      { id: "r1", kind: "reasoning", role: "agent", text: "think" },
      { id: "a1", role: "agent", content: "answer" },
      { id: "u2", role: "user", content: "again" },
    ];
    const turns = splitMessagesIntoTurns(msgs);
    expect(turns).toHaveLength(2);
    expect(turns[0].user?.id).toBe("u1");
    expect(turns[0].agent).toHaveLength(2);
    expect(turns[1].user?.id).toBe("u2");
    expect(turns[1].agent).toHaveLength(0);
  });
});
