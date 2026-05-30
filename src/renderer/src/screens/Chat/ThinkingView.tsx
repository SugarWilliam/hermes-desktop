import { memo, useEffect, useState } from "react";
import { AgentMarkdown } from "../../components/AgentMarkdown";
import {
  inferFenceLanguage,
  langCssClass,
} from "../../../../shared/markdownCodeStyle";
import {
  PRISM_BLOCK_OPTIONS,
  PRISM_BLOCK_STYLE,
  prismCodeTagProps,
} from "../../components/MarkdownPrism";
import { parseThinkingContent } from "./parseThinkingContent";

let _highlighterMod: typeof import("react-syntax-highlighter") | null = null;

function loadHighlighter(): Promise<void> {
  if (_highlighterMod) return Promise.resolve();
  return import("react-syntax-highlighter").then((mod) => {
    _highlighterMod = mod;
  });
}

function ThinkingCodeBlock({
  language,
  code,
  file,
  added,
  removed,
}: {
  language: string;
  code: string;
  file?: string;
  added?: number;
  removed?: number;
}): React.JSX.Element {
  const [ready, setReady] = useState(() => _highlighterMod !== null);
  const prismLang = inferFenceLanguage(code, language);
  const langClass = langCssClass(prismLang);

  useEffect(() => {
    if (!ready) void loadHighlighter().then(() => setReady(true));
  }, [ready]);

  const displayName = file || language || "code";

  return (
    <div className={`thinking-code-block chat-code-block ${langClass}`}>
      <div className="thinking-code-header chat-code-header">
        <span className={`thinking-code-file chat-code-lang ${langClass}`}>
          # {displayName}
        </span>
        <span className="thinking-code-stats">
          {added != null && (
            <span className="thinking-stat thinking-stat--add">+{added}</span>
          )}
          {removed != null && (
            <span className="thinking-stat thinking-stat--del">-{removed}</span>
          )}
        </span>
      </div>
      <div className="thinking-code-body">
        {ready && _highlighterMod ? (
          <_highlighterMod.Prism
            style={PRISM_BLOCK_STYLE}
            language={prismLang}
            PreTag="div"
            codeTagProps={prismCodeTagProps(prismLang)}
            {...PRISM_BLOCK_OPTIONS}
            customStyle={{
              margin: 0,
              padding: "10px 12px",
              background: "transparent",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {code}
          </_highlighterMod.Prism>
        ) : (
          <pre className="thinking-code-fallback">{code}</pre>
        )}
      </div>
    </div>
  );
}

export const ThinkingView = memo(function ThinkingView({
  text,
  placeholder,
}: {
  text: string;
  placeholder?: string;
}): React.JSX.Element {
  const body = text.trim();
  if (!body) {
    return placeholder ? (
      <p className="agent-run-placeholder">{placeholder}</p>
    ) : (
      <p className="agent-run-placeholder">…</p>
    );
  }

  const segments = parseThinkingContent(body);

  return (
    <div className="thinking-view">
      {segments.map((seg, i) => {
        if (seg.type === "meta") {
          return (
            <p key={`m-${i}`} className="thinking-meta">
              {seg.text}
            </p>
          );
        }
        if (seg.type === "prose") {
          return (
            <div key={`p-${i}`} className="thinking-prose">
              <AgentMarkdown variant="chat">{seg.text}</AgentMarkdown>
            </div>
          );
        }
        return (
          <ThinkingCodeBlock
            key={`c-${i}`}
            language={seg.language}
            code={seg.code}
            file={seg.file}
            added={seg.added}
            removed={seg.removed}
          />
        );
      })}
    </div>
  );
});
