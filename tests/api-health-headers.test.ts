import { describe, expect, it } from "vitest";
import { buildApiHealthHeaders } from "../src/shared/apiHealthHeaders";

describe("buildApiHealthHeaders", () => {
  it("includes Bearer token in local mode", () => {
    expect(
      buildApiHealthHeaders({
        mode: "local",
        apiServerKey: "test-secret-key",
      }),
    ).toEqual({ Authorization: "Bearer test-secret-key" });
  });

  it("omits Bearer when no API key is configured locally", () => {
    expect(buildApiHealthHeaders({ mode: "local" })).toEqual({});
  });

  it("includes remote api key in remote mode", () => {
    expect(
      buildApiHealthHeaders({
        mode: "remote",
        remoteApiKey: "remote-key",
      }),
    ).toEqual({ Authorization: "Bearer remote-key" });
  });
});
