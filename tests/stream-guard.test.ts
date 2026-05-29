import { describe, expect, it } from "vitest";
import { createStreamGuard } from "../src/renderer/src/screens/Chat/streamGuard";

describe("createStreamGuard", () => {
  it("ignores events after invalidate without a new claim", () => {
    let bound: string | null = "sess-a";
    const guard = createStreamGuard(() => bound);

    guard.claim();
    expect(guard.isActive()).toBe(true);

    guard.invalidate();
    expect(guard.isActive()).toBe(false);
    expect(guard.acceptsSession("sess-a")).toBe(false);
  });

  it("accepts session id only when bound matches", () => {
    let bound: string | null = "sess-a";
    const guard = createStreamGuard(() => bound);
    guard.claim();

    expect(guard.acceptsSession("sess-a")).toBe(true);
    expect(guard.acceptsSession("sess-b")).toBe(false);

    bound = "sess-b";
    expect(guard.acceptsSession("sess-a")).toBe(false);
    expect(guard.acceptsSession("sess-b")).toBe(true);
  });

  it("allows events with no session id before bound is set", () => {
    const guard = createStreamGuard(() => null);
    guard.claim();

    expect(guard.acceptsSession(undefined)).toBe(true);
    expect(guard.acceptsSession("")).toBe(true);
  });
});
