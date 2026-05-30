import { describe, expect, it } from "vitest";
import { enrichChatErrorMessage } from "../src/shared/chatErrorHints";

const HINTS = {
  codexTtfb: "CODEX_HINT",
  contextLength: "CTX_HINT",
  agentIdle: "IDLE_HINT",
  sessionNotFound: "SESSION_HINT",
  apiServerKey: "API_KEY_HINT",
  gatewayApiUnavailable: "GW_HINT",
};

describe("enrichChatErrorMessage", () => {
  it("appends hint for codex ttfb errors", () => {
    const msg =
      "API call failed after 3 retries: Codex stream produced no bytes within 12s (TTFB threshold: 12s)";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain(msg);
    expect(out).toContain("CODEX_HINT");
  });

  it("appends hint for context length errors", () => {
    const msg =
      "Context length exceeded (4,822 tokens). Cannot compress further.";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain(msg);
    expect(out).toContain("CTX_HINT");
  });

  it("appends hint for agent idle timeout", () => {
    const msg =
      "Agent produced no output for 5 minutes. Check the gateway, model, and API key, then try again.";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain("IDLE_HINT");
  });

  it("leaves unrelated errors unchanged", () => {
    expect(enrichChatErrorMessage("network down", HINTS)).toBe("network down");
  });

  it("appends hint for session not found", () => {
    const msg =
      "Session not found: desk-1780106314408-65a66ba6-fdb1-47da-867d-18c0a9316f8f";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain("SESSION_HINT");
  });

  it("appends hint for missing API_SERVER_KEY", () => {
    const msg =
      "Gateway API is unavailable: API_SERVER_KEY is not configured.";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain("API_KEY_HINT");
  });

  it("appends hint when gateway api is unavailable", () => {
    const msg =
      "Gateway API is unavailable. Restart Gateway (Settings → Gateway) and retry.";
    const out = enrichChatErrorMessage(msg, HINTS);
    expect(out).toContain("GW_HINT");
  });
});
