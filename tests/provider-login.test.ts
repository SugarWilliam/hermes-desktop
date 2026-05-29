import { describe, it, expect } from "vitest";
import {
  resolveOAuthProviderId,
  canAttemptOAuthLogin,
} from "../src/shared/providerLogin";

describe("resolveOAuthProviderId", () => {
  it("maps env keys to OAuth provider ids", () => {
    expect(resolveOAuthProviderId("OPENAI_API_KEY")).toBe("openai-codex");
    expect(resolveOAuthProviderId("GOOGLE_API_KEY")).toBe("google-gemini-cli");
    expect(resolveOAuthProviderId("XAI_API_KEY")).toBe("xai-oauth");
  });

  it("maps UI provider aliases", () => {
    expect(resolveOAuthProviderId("openai")).toBe("openai-codex");
    expect(resolveOAuthProviderId("copilot")).toBe("copilot");
    expect(resolveOAuthProviderId("deepseek")).toBe("deepseek");
  });

  it("derives provider id from generic *_API_KEY env keys", () => {
    expect(resolveOAuthProviderId("GROQ_API_KEY")).toBe("groq");
    expect(resolveOAuthProviderId("DEEPSEEK_API_KEY")).toBe("deepseek");
  });
});

describe("canAttemptOAuthLogin", () => {
  it("allows named providers", () => {
    expect(canAttemptOAuthLogin("openrouter")).toBe(true);
    expect(canAttemptOAuthLogin("OPENAI_API_KEY")).toBe(true);
  });

  it("skips auto, local, custom", () => {
    expect(canAttemptOAuthLogin("auto")).toBe(false);
    expect(canAttemptOAuthLogin("local")).toBe(false);
    expect(canAttemptOAuthLogin("custom")).toBe(false);
  });
});
