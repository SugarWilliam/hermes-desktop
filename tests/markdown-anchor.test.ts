import { describe, expect, it } from "vitest";
import {
  createUniqueSlugger,
  resolveAnchorTarget,
  slugifyHeading,
} from "../src/renderer/src/components/markdownAnchor";

describe("slugifyHeading", () => {
  it("normalizes numbered Chinese headings", () => {
    expect(slugifyHeading("1. 项目背景与目标")).toBe("1-项目背景与目标");
    expect(slugifyHeading("1.1 现有痛点（MECE 三域）")).toBe(
      "11-现有痛点mece-三域",
    );
  });

  it("deduplicates repeated headings", () => {
    const slug = createUniqueSlugger();
    expect(slug("Overview")).toBe("overview");
    expect(slug("Overview")).toBe("overview-1");
  });
});

describe("resolveAnchorTarget", () => {
  it("finds heading by generated id", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<h2 id="1-项目背景与目标">1. 项目背景与目标</h2><p>body</p>';
    const el = resolveAnchorTarget(root, "#1-项目背景与目标");
    expect(el?.tagName).toBe("H2");
  });

  it("matches slugified heading text when id differs slightly", () => {
    const root = document.createElement("div");
    root.innerHTML = "<h2>1. 项目背景与目标</h2>";
    const el = resolveAnchorTarget(root, "#1-项目背景与目标");
    expect(el?.textContent).toContain("项目背景");
  });
});
