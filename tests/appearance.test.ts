import { describe, expect, it } from "vitest";
import {
  agentFontStack,
  fontScaleFactor,
  isColorTheme,
  uiFontStack,
} from "../src/shared/appearance";

describe("appearance", () => {
  it("validates color themes", () => {
    expect(isColorTheme("default")).toBe(true);
    expect(isColorTheme("midnight")).toBe(true);
    expect(isColorTheme("invalid")).toBe(false);
  });

  it("scales font sizes", () => {
    expect(fontScaleFactor("md")).toBe(1);
    expect(fontScaleFactor("lg")).toBe(1.125);
  });

  it("returns courier stack for default agent font", () => {
    expect(agentFontStack("courier")).toContain("Courier New");
  });

  it("includes CJK fallbacks in ui and agent font stacks", () => {
    expect(uiFontStack("google-sans")).toContain("Microsoft YaHei");
    expect(uiFontStack("google-sans")).toContain("微软雅黑");
    expect(uiFontStack("google-sans")).toContain("黑体");
    expect(agentFontStack("courier")).toContain("SimHei");
  });
});
