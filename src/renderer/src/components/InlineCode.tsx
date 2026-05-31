import { classifyInlineCode } from "../../../shared/markdownCodeStyle";
import { FileRefChip } from "./FileRefChip";

export function InlineCode({
  text,
  workspaceRoot,
}: {
  text: string;
  workspaceRoot?: string | null;
}): React.JSX.Element {
  const { classNames, segments } = classifyInlineCode(text);
  const hasParts = segments.length > 1 || segments[0]?.className !== "md-code-default";

  if (!hasParts) {
    return <code className={classNames.join(" ")}>{text}</code>;
  }

  // Check if this is a file reference: has md-code-file segment
  let fileRefPath = "";
  let fileRefName = "";
  let fileRefLines: string | undefined;
  for (const seg of segments) {
    if (seg.className === "md-code-file") {
      fileRefPath = seg.text;
      fileRefName = seg.text.split(/[\\/]/).pop() ?? seg.text;
    }
    if (seg.className === "md-code-lines") {
      fileRefLines = seg.text;
    }
  }

  if (fileRefPath) {
    // Render as clickable file reference chip
    return (
      <code className={classNames.join(" ")}>
        <FileRefChip
          fullPath={fileRefPath}
          displayName={fileRefName}
          lineRange={fileRefLines}
          workspaceRoot={workspaceRoot}
        />
      </code>
    );
  }

  return (
    <code className={classNames.join(" ")}>
      {segments.map((seg, i) => (
        <span key={i} className={seg.className}>
          {seg.text}
        </span>
      ))}
    </code>
  );
}
