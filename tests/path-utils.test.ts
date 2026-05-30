import { describe, expect, it } from "vitest";
import { parentDirectory, resolvePathUnderRoot } from "../src/shared/pathUtils";

describe("parentDirectory", () => {
  it("returns parent on Windows paths", () => {
    expect(parentDirectory("C:\\Users\\Reolink\\doc.md")).toBe(
      "C:\\Users\\Reolink",
    );
  });

  it("returns parent on POSIX paths", () => {
    expect(parentDirectory("/home/user/doc.md")).toBe("/home/user");
  });

  it("returns null for bare filename", () => {
    expect(parentDirectory("doc.md")).toBeNull();
  });
});

describe("resolvePathUnderRoot", () => {
  it("joins relative paths under workspace root", () => {
    expect(resolvePathUnderRoot("notes/doc.md", "/home/user/project")).toBe(
      "/home/user/project/notes/doc.md",
    );
  });

  it("keeps absolute paths unchanged", () => {
    expect(resolvePathUnderRoot("C:\\tmp\\a.md", "C:\\root")).toBe("C:\\tmp\\a.md");
  });
});
