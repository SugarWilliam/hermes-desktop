import { extractWorkspaceReferenceFromBlock } from "../../../../shared/workspaceContext";

/**
 * Text shown in user chat bubbles — strips inlined file/workspace bodies
 * so attachments and @-references stay compact (Cursor / Qoder style).
 */
export function displayTextForUserMessage(content: string): string {
  const ref = extractWorkspaceReferenceFromBlock(content);
  if (ref && content.trim().startsWith("Context from")) return ref;
  if (ref && content.trim().startsWith("Selected snippet")) return ref;

  let text = content;
  text = text.replace(
    /Context from (?:file `[^`]+`|`[^`]+`)[^\n]*:\n\n```[\s\S]*?```[^\n]*/gi,
    "",
  );
  text = text.replace(
    /Selected snippet from `[^`]+`:\n\n```[\s\S]*?```/gi,
    "",
  );
  text = text.replace(/<file[^>]*>[\s\S]*?<\/file>/gi, "");
  text = text.replace(/\[Attached file:[^\]]+\]\s*/gi, "");
  text = text.replace(
    /Please scope work to this workspace folder:\n\n```[\s\S]*?```/gi,
    "",
  );
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
