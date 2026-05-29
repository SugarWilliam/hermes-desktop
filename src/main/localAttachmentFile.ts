import { readFile, stat } from "fs/promises";
import { basename } from "path";
import { isTextFile, MAX_TEXT_BYTES } from "../shared/attachments";

export async function readLocalAttachmentFile(
  absPath: string,
): Promise<{ content: string; truncated: boolean; name: string }> {
  const name = basename(absPath);
  if (!isTextFile("", name)) {
    throw new Error("Only text/code files can be inlined as attachments");
  }
  const st = await stat(absPath);
  if (!st.isFile()) throw new Error("Not a file");
  const buf = await readFile(absPath);
  const truncated = buf.length > MAX_TEXT_BYTES;
  const slice = truncated ? buf.subarray(0, MAX_TEXT_BYTES) : buf;
  return { content: slice.toString("utf-8"), truncated, name };
}
