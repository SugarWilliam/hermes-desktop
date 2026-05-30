import { describe, expect, it } from "vitest";
import {
  classifyInlineCode,
  inferFenceLanguage,
  langCssClass,
  normalizeHighlightLanguage,
} from "../src/shared/markdownCodeStyle";

describe("normalizeHighlightLanguage", () => {
  it("maps common extensions", () => {
    expect(normalizeHighlightLanguage("hpp")).toBe("cpp");
    expect(normalizeHighlightLanguage("py")).toBe("python");
    expect(normalizeHighlightLanguage("sh")).toBe("bash");
  });
});

describe("langCssClass", () => {
  it("produces stable class names", () => {
    expect(langCssClass("cpp")).toBe("md-code-lang--cpp");
    expect(langCssClass("c++")).toBe("md-code-lang--cpp");
  });
});

describe("inferFenceLanguage", () => {
  it("keeps explicit fence language", () => {
    expect(inferFenceLanguage("x", "cpp")).toBe("cpp");
    expect(inferFenceLanguage("x", "c++")).toBe("cpp");
  });

  it("detects ini/sysctl style blocks", () => {
    const sysctl = "vm.swappiness=100\n# comment\nkernel.panic=10";
    expect(inferFenceLanguage(sysctl)).toBe("ini");
    expect(inferFenceLanguage(sysctl, "ini")).toBe("ini");
  });

  it("detects python, json, bash, cpp", () => {
    expect(inferFenceLanguage('#!/bin/bash\necho hi')).toBe("bash");
    expect(inferFenceLanguage('{"a":1}')).toBe("json");
    expect(inferFenceLanguage("def main():\n  pass")).toBe("python");
    expect(inferFenceLanguage("#include <stdio.h>\nint main() {}")).toBe("cpp");
  });
});

describe("classifyInlineCode", () => {
  it("classifies file paths with line ranges", () => {
    const r = classifyInlineCode("product/modules/ptz/src/bc_ptz.cpp:6813-6839");
    expect(r.classNames).toContain("md-code-path");
    expect(r.classNames).toContain("md-code-lang--cpp");
    expect(r.segments.map((s) => s.className)).toEqual([
      "md-code-file",
      "md-code-sep",
      "md-code-lines",
    ]);
    expect(r.segments[2]?.text).toBe("6813-6839");
  });

  it("classifies macros", () => {
    const r = classifyInlineCode("MSG_PTZ_AF_START");
    expect(r.classNames).toContain("md-code-macro");
  });

  it("classifies qualified function calls", () => {
    const r = classifyInlineCode("bc_ptz::ptz_check_af()");
    expect(r.segments.some((s) => s.className === "md-code-fn")).toBe(true);
    expect(r.segments.some((s) => s.text === "::")).toBe(true);
  });

  it("classifies member access", () => {
    const r = classifyInlineCode("pmedia_input->af_check()");
    expect(r.segments.some((s) => s.className === "md-code-field")).toBe(true);
  });
});
