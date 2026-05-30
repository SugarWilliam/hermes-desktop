import { describe, expect, it } from "vitest";
import { cliResumeSessionId } from "../src/shared/sessionIds";

describe("cliResumeSessionId", () => {
  it("strips desktop desk-* ids for CLI fallback", () => {
    expect(
      cliResumeSessionId(
        "desk-1780106314408-65a66ba6-fdb1-47da-867d-18c0a9316f8f",
      ),
    ).toBeUndefined();
  });

  it("keeps gateway/cli session ids", () => {
    expect(cliResumeSessionId("20260529_200951_2190da")).toBe(
      "20260529_200951_2190da",
    );
  });
});
