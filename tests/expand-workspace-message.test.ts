/** @vitest-environment node */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  asksToLoadCapabilities,
  extractFolderReferences,
} from "../src/shared/workspaceReferences";
import {
  expandWorkspaceMessage,
  resolveFolderUnderRoot,
  scanProjectCapabilities,
} from "../src/main/expandWorkspaceMessage";

describe("workspaceReferences", () => {
  it("extracts @folder tokens", () => {
    expect(
      extractFolderReferences("@folder:reolink_agent 加载能力"),
    ).toEqual(["reolink_agent"]);
    expect(
      extractFolderReferences("@folder:reolink_agent加载reolink_agent的所有能力"),
    ).toEqual(["reolink_agent"]);
    expect(
      extractFolderReferences("@folder:/tmp/proj/reolink_agent 加载"),
    ).toEqual(["/tmp/proj/reolink_agent"]);
  });

  it("detects capability-load intents", () => {
    expect(asksToLoadCapabilities("加载reolink_agent的所有能力")).toBe(true);
    expect(asksToLoadCapabilities("load project skills")).toBe(true);
    expect(asksToLoadCapabilities("hello")).toBe(false);
  });
});

describe("expandWorkspaceMessage", () => {
  let base = "";
  let root = "";
  let sub = "";

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "hermes-cap-"));
    root = join(base, "workspace");
    sub = join(root, "reolink_agent");
    mkdirSync(join(sub, ".cursor", "rules"), { recursive: true });
    mkdirSync(join(sub, "skills", "demo-skill"), { recursive: true });
    writeFileSync(join(sub, "AGENTS.md"), "# Agent rules\nDo X");
    writeFileSync(join(sub, ".cursor", "rules", "coding.mdc"), "rule body");
    writeFileSync(join(sub, "skills", "demo-skill", "SKILL.md"), "# Demo skill");
  });

  afterAll(() => {
    if (base) rmSync(base, { recursive: true, force: true });
  });

  it("creates fixture paths", () => {
    expect(existsSync(sub)).toBe(true);
  });

  it("resolves subfolder under context root", () => {
    expect(resolveFolderUnderRoot(root, "reolink_agent")).toBe(sub);
  });

  it("scans rules and skills", () => {
    const entries = scanProjectCapabilities(sub);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("agents");
    expect(kinds).toContain("rule");
    expect(kinds).toContain("skill");
  });

  it("inlines capabilities for @folder + load request", () => {
    const fullRef = `@folder:${sub.replace(/\\/g, "/")} 加载reolink_agent的所有能力`;
    const { message } = expandWorkspaceMessage(fullRef, root);
    expect(message).toContain("Resolved @folder reference");
    expect(message).toContain(sub);
    expect(message).toContain("Loaded project capabilities");
    expect(message).toContain("Agent rules");
    expect(message).toContain("Demo skill");
  });

  it("parses @folder:name before Chinese text without space", () => {
    const { message } = expandWorkspaceMessage(
      "@folder:reolink_agent加载reolink_agent的所有能力",
      root,
    );
    expect(message).toContain("Resolved @folder reference");
    expect(message).toContain(sub);
  });
});
