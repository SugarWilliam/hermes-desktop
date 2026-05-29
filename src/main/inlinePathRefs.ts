import { readFileSync, statSync } from "fs";
import { basename } from "path";
import {
  isTextFile,
  MAX_TEXT_BYTES,
  type Attachment,
} from "../shared/attachments";

/**
 * Inline path-ref attachments as text-file when the path points to a
 * readable text/code file on disk. Workspace right-click "add file" uses
 * path-ref; without inlining the agent only sees a path string and may
 * wander the repo instead of reading the attachment.
 */
export function inlinePathRefAttachments(
  attachments?: Attachment[],
): Attachment[] | undefined {
  if (!attachments || attachments.length === 0) return attachments;

  return attachments.map((a) => {
    if (a.kind !== "path-ref" || !a.path) return a;
    const name = a.name || basename(a.path);
    if (!isTextFile(a.mime || "", name)) return a;
    try {
      const st = statSync(a.path);
      if (!st.isFile()) return a;
      const buf = readFileSync(a.path);
      const truncated = buf.length > MAX_TEXT_BYTES;
      const slice = truncated ? buf.subarray(0, MAX_TEXT_BYTES) : buf;
      return {
        ...a,
        kind: "text-file" as const,
        text: slice.toString("utf-8"),
        size: buf.length,
        mime: a.mime && a.mime !== "application/octet-stream" ? a.mime : "text/plain",
      };
    } catch {
      return a;
    }
  });
}
