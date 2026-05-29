import { describe, expect, it } from "vitest";
import { getContextMenuLabels } from "../src/main/context-menu";

describe("getContextMenuLabels", () => {
  it("returns localized strings for all menu entries", () => {
    const labels = getContextMenuLabels();
    expect(labels.addSelection.length).toBeGreaterThan(0);
    expect(labels.selectAll.length).toBeGreaterThan(0);
    expect(labels.copyChatText).toMatch(/chat/i);
    expect(labels.copyChatMarkdown).toMatch(/Markdown/i);
  });
});
