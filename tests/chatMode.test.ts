import { describe, expect, it } from "vitest";
import {
  shouldSuggestPlanMode,
  chatModeSystemMessage,
  chatModeCliPrefix,
  isPlanReadyForApproval,
} from "../src/shared/chatMode";

describe("shouldSuggestPlanMode", () => {
  it("returns false for short simple messages", () => {
    expect(shouldSuggestPlanMode("hello")).toBe(false);
  });

  it("returns true for long messages", () => {
    expect(shouldSuggestPlanMode("x".repeat(400))).toBe(true);
  });

  it("returns true for planning keywords", () => {
    expect(shouldSuggestPlanMode("请帮我重构整个模块架构")).toBe(true);
    expect(shouldSuggestPlanMode("multi-step deployment plan")).toBe(true);
  });
});

describe("chatModeSystemMessage", () => {
  it("returns null for chat mode", () => {
    expect(chatModeSystemMessage("chat")).toBeNull();
  });

  it("returns system prompts for agent and plan", () => {
    expect(chatModeSystemMessage("agent")?.role).toBe("system");
    expect(chatModeSystemMessage("plan")?.content).toMatch(/Plan mode/i);
  });
});

describe("isPlanReadyForApproval", () => {
  it("returns false when not in plan mode or still loading", () => {
    expect(
      isPlanReadyForApproval(
        [
          { role: "user", content: "plan this" },
          { role: "agent", content: "## Plan\n1. step" },
        ],
        false,
        "chat",
      ),
    ).toBe(false);
    expect(
      isPlanReadyForApproval(
        [{ role: "user", content: "x" }],
        true,
        "plan",
      ),
    ).toBe(false);
  });

  it("returns true after agent plan reply in plan mode", () => {
    expect(
      isPlanReadyForApproval(
        [
          { role: "user", content: "Refactor the module" },
          { role: "agent", content: "## Steps\n1. Analyze\n2. Implement" },
        ],
        false,
        "plan",
      ),
    ).toBe(true);
  });
});

describe("chatModeCliPrefix", () => {
  it("prefixes non-chat modes", () => {
    expect(chatModeCliPrefix("agent")).toContain("Agent");
    expect(chatModeCliPrefix("plan")).toContain("Plan");
    expect(chatModeCliPrefix("chat")).toBe("");
  });
});
