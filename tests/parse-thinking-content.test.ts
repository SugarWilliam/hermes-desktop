import { describe, expect, it } from "vitest";
import { parseThinkingContent } from "../src/renderer/src/screens/Chat/parseThinkingContent";

describe("parseThinkingContent", () => {
  it("splits fenced code with file header", () => {
    const raw = `Explored 1 file

# agent-markdown.css
+124 -149
\`\`\`css
.selector { color: red; }
\`\`\``;
    const segs = parseThinkingContent(raw);
    expect(segs.some((s) => s.type === "meta")).toBe(true);
    const code = segs.find((s) => s.type === "code");
    expect(code?.type).toBe("code");
    if (code?.type === "code") {
      expect(code.file).toBe("agent-markdown.css");
      expect(code.added).toBe(124);
      expect(code.removed).toBe(149);
      expect(code.language).toBe("css");
    }
  });
});
