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
 *
 * Wrapped to never throw — returns original attachments on any failure.
 */
export function inlinePathRefAttachments(
  attachments?: Attachment[],
): Attachment[] | undefined {
  if (!attachments || attachments.length === 0) return attachments;

  try {
    return attachments.map((a) => {
      if (a.kind !== "path-ref" || !a.path) return a;
      try {
        const name = a.name || basename(a.path);
        if (!isTextFile(a.mime || "", name)) return a;
        const st = statSync(a.path);
        if (!st.isFile()) return a;
        // Skip excessively large files (> 256KB)
        if (st.size > MAX_TEXT_BYTES) return a;
        const buf = readFileSync(a.path);
        // Skip binary files (null byte check)
        const sampleSize = Math.min(buf.length, 8192);
        for (let i = 0; i < sampleSize; i++) {
          if (buf[i] === 0) return a;
        }
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
  } catch {
    return attachments;
  }
}
