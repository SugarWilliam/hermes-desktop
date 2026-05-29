import { describe, it, expect } from "vitest";
import { displayTextForUserMessage } from "../src/renderer/src/screens/Chat/userMessageDisplay";

describe("displayTextForUserMessage", () => {
  it("replaces legacy file context blocks with @ references", () => {
    const raw =
      "Context from file `/proj/a.md`:\n\n```md\n# Hello\nlong body\n```";
    expect(displayTextForUserMessage(raw)).toBe("@a.md");
  });

  it("strips attached-file lines from visible text", () => {
    expect(
      displayTextForUserMessage(
        "fix this\n\n[Attached file: C:\\docs\\x.pdf]\n",
      ),
    ).toBe("fix this");
  });
});
