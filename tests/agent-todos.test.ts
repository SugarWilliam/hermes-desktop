import { describe, it, expect } from "vitest";
import {
  extractLatestAgentTodos,
  extractCurrentTurnTodos,
} from "../src/renderer/src/screens/Chat/agentTodos";
import type { ChatMessage } from "../src/renderer/src/screens/Chat/types";

describe("agentTodos", () => {
  it("parses todo_write tool calls", () => {
    const messages: ChatMessage[] = [
      {
        id: "tc1",
        kind: "tool_call",
        role: "agent",
        callId: "c1",
        name: "todo_write",
        args: JSON.stringify({
          todos: [
            { id: "1", content: "Read attached file", status: "in_progress" },
            { id: "2", content: "Write evaluation", status: "pending" },
          ],
        }),
      },
    ];
    const todos = extractLatestAgentTodos(messages);
    expect(todos).toHaveLength(2);
    expect(todos[0].status).toBe("in_progress");
  });

  it("scopes todos to the current turn after the last user message", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        role: "user",
        content: "old",
      },
      {
        id: "tc-old",
        kind: "tool_call",
        role: "agent",
        callId: "old",
        name: "todo_write",
        args: JSON.stringify({
          todos: [{ id: "x", content: "old task", status: "completed" }],
        }),
      },
      {
        id: "u2",
        role: "user",
        content: "new",
      },
      {
        id: "tc-new",
        kind: "tool_call",
        role: "agent",
        callId: "new",
        name: "todo_write",
        args: JSON.stringify({
          todos: [{ id: "y", content: "new task", status: "pending" }],
        }),
      },
    ];
    const todos = extractCurrentTurnTodos(messages);
    expect(todos).toHaveLength(1);
    expect(todos[0].content).toBe("new task");
  });
});
