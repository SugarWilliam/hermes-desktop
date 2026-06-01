import { describe, expect, it } from "vitest";
import { parseCallout, stripCalloutPrefix } from "../src/shared/markdownCallout";

describe("parseCallout", () => {
  it("parses GFM alerts", () => {
    const n = parseCallout("[!WARNING] Disk almost full");
    expect(n?.kind).toBe("warning");
    expect(n?.title).toBe("Warning");
  });

  it("parses Chinese alert prefixes", () => {
    const n = parseCallout("注意：请先备份配置");
    expect(n?.kind).toBe("warning");
    expect(n?.title).toBe("注意");
  });

  it("returns null for plain quotes", () => {
    expect(parseCallout("这是一段普通引用")).toBeNull();
  });
});

describe("stripCalloutPrefix", () => {
  it("removes GFM prefix", () => {
    const p = parseCallout("[!NOTE] Hello")!;
    expect(stripCalloutPrefix("[!NOTE] Hello", p.prefixPattern)).toBe("Hello");
  });
});
