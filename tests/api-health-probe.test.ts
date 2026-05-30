import { describe, expect, it } from "vitest";
import { isHttpHealthOk } from "../src/main/hermes";

describe("isHttpHealthOk", () => {
  it("accepts 2xx", () => {
    expect(isHttpHealthOk(200)).toBe(true);
    expect(isHttpHealthOk(204)).toBe(true);
  });

  it("rejects non-success", () => {
    expect(isHttpHealthOk(401)).toBe(false);
    expect(isHttpHealthOk(404)).toBe(false);
    expect(isHttpHealthOk(undefined)).toBe(false);
  });
});
