import { describe, it, expect } from "vitest";
import { attachmentFocusDirective } from "../src/shared/attachmentContext";
import type { Attachment } from "../src/shared/attachments";

describe("attachmentFocusDirective", () => {
  it("returns empty string when no attachments", () => {
    expect(attachmentFocusDirective([])).toBe("");
  });

  it("names attached files and asks to focus on them", () => {
    const attachments: Attachment[] = [
      {
        id: "1",
        kind: "path-ref",
        name: "doc.md",
        mime: "text/markdown",
        size: 0,
        path: "/tmp/doc.md",
      },
    ];
    const text = attachmentFocusDirective(attachments);
    expect(text).toContain("doc.md");
    expect(text).toMatch(/attached file/i);
    expect(text).toMatch(/do not scan/i);
  });
});
