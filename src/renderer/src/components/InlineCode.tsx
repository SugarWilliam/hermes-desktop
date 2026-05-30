import { classifyInlineCode } from "../../../shared/markdownCodeStyle";

export function InlineCode({ text }: { text: string }): React.JSX.Element {
  const { classNames, segments } = classifyInlineCode(text);
  const hasParts = segments.length > 1 || segments[0]?.className !== "md-code-default";

  return (
    <code className={classNames.join(" ")}>
      {hasParts
        ? segments.map((seg, i) => (
            <span key={i} className={seg.className}>
              {seg.text}
            </span>
          ))
        : text}
    </code>
  );
}
