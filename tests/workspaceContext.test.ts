import { describe, expect, it } from "vitest";
import {
  extractWorkspaceReferenceFromBlock,
  formatWorkspaceFileBlock,
  formatWorkspaceFileReference,
  formatWorkspaceFolderBlock,
  formatWorkspaceFolderReference,
  formatWorkspaceSelectionBlock,
  formatWorkspaceSelectionReference,
} from "../src/shared/workspaceContext";

describe("workspaceContext references", () => {
  it("formats compact file references", () => {
    expect(formatWorkspaceFileReference("/proj/main.cpp")).toBe("@main.cpp");
  });

  it("extracts reference from legacy file blocks", () => {
    const block = formatWorkspaceFileBlock("/a/b.ts", "export {}");
    expect(extractWorkspaceReferenceFromBlock(block)).toBe("@b.ts");
  });

  it("formats folder and selection references", () => {
    expect(formatWorkspaceFolderReference("/proj/src")).toBe("@folder:/proj/src");
    expect(formatWorkspaceSelectionReference("/a/b.ts")).toBe("@b.ts (selection)");
  });
});

describe("workspaceContext formatters", () => {
  it("formats file blocks with language", () => {
    const block = formatWorkspaceFileBlock("/proj/main.cpp", "int main() {}");
    expect(block).toContain("main.cpp");
    expect(block).toContain("```cpp");
    expect(block).toContain("int main()");
  });

  it("formats folder references", () => {
    expect(formatWorkspaceFolderBlock("/proj/src")).toContain("/proj/src");
  });

  it("formats non-empty selections", () => {
    const block = formatWorkspaceSelectionBlock("/a/b.ts", "export {}");
    expect(block).toContain("b.ts");
    expect(block).toContain("export {}");
    expect(formatWorkspaceSelectionBlock(null, "   ")).toBe("");
  });
});
