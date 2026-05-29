import type { Attachment } from "./attachments";

/** User-message preamble so the agent scopes work to attached files. */
export function attachmentFocusDirective(
  attachments: ReadonlyArray<Attachment>,
): string {
  const effective = attachments.filter((a) => {
    if (a.kind === "text-file") return typeof a.text === "string";
    if (a.kind === "path-ref")
      return typeof a.path === "string" && a.path.length > 0;
    return false;
  });
  const labels = effective
    .map((a) => a.name || a.path || "")
    .filter((s) => s.length > 0);
  if (labels.length === 0) return "";
  return (
    "IMPORTANT: The user attached specific file(s) for this request. " +
    "Read and evaluate the attached file contents below first. " +
    "Do not scan the whole repository or unrelated directories unless " +
    "the user explicitly asks for a broader review.\n" +
    `Attached file(s): ${labels.join(", ")}`
  );
}
