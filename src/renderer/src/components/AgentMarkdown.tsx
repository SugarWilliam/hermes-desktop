import { useState, useEffect, useMemo, memo, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy } from "lucide-react";
import { useI18n } from "./useI18n";
import { MediaImage, DownloadChip } from "./MediaImage";
import { describeImageSrc } from "../screens/Chat/mediaUtils";
import {
  inferFenceLanguage,
  langCssClass,
} from "../../../shared/markdownCodeStyle";
import { InlineCode } from "./InlineCode";
import { DiffApplyView } from "./DiffApplyView";
import { MermaidDiagram } from "./MermaidDiagram";
import {
  PRISM_BLOCK_OPTIONS,
  PRISM_BLOCK_STYLE,
  prismCodeTagProps,
} from "./MarkdownPrism";
import {
  createUniqueSlugger,
  isExternalHref,
  scrollToMarkdownAnchor,
} from "./markdownAnchor";
import {
  calloutBodyChildren,
  detectCallout,
} from "./markdownCalloutBody";

// Lazy-load the heavy syntax highlighter — only imported when a code block renders
let _highlighterMod: typeof import("react-syntax-highlighter") | null = null;
let _loadingPromise: Promise<void> | null = null;

function loadHighlighter(): Promise<void> {
  if (_highlighterMod) return Promise.resolve();
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = import("react-syntax-highlighter").then((mod) => {
    _highlighterMod = mod;
  });
  return _loadingPromise;
}

function cellTextContent(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellTextContent).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return cellTextContent(props?.children);
  }
  return "";
}

function statusClassForText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (
    /^(危险|高风险|失败|异常|错误|error|fail(?:ed)?|danger|risk|critical|fatal)$/i.test(
      t,
    )
  ) {
    return "md-status md-status--danger";
  }
  if (
    /^(优秀|良好|通过|成功|正常|ok|pass(?:ed)?|success|excellent|good|healthy)$/i.test(
      t,
    )
  ) {
    return "md-status md-status--success";
  }
  if (/^(警告|注意|待处理|warn(?:ing)?|pending|caution)$/i.test(t)) {
    return "md-status md-status--warn";
  }
  return null;
}

function MarkdownTableCell({
  isHeader,
  children,
}: {
  isHeader: boolean;
  children?: ReactNode;
}): React.JSX.Element {
  const Tag = isHeader ? "th" : "td";
  const text = cellTextContent(children).trim();
  const statusClass = statusClassForText(text);
  if (statusClass) {
    return (
      <Tag>
        <span className={statusClass}>{children}</span>
      </Tag>
    );
  }
  return <Tag>{children}</Tag>;
}

// Diff viewer with colored +/- lines
function DiffView({ code }: { code: string }): React.JSX.Element {
  const lines = code.split("\n");
  return (
    <div className="chat-diff-content">
      {lines.map((line, i) => {
        let cls = "chat-diff-line";
        if (line.startsWith("+")) cls += " chat-diff-add";
        else if (line.startsWith("-")) cls += " chat-diff-remove";
        else if (line.startsWith("@@")) cls += " chat-diff-hunk";
        return (
          <div key={i} className={cls}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

// Code block with syntax highlighting and copy button (lazy-loaded highlighter)
function CodeBlock({
  className,
  children,
  workspaceRoot,
}: {
  className?: string;
  children?: React.ReactNode;
  workspaceRoot?: string;
}): React.JSX.Element {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [highlighterReady, setHighlighterReady] = useState(
    () => _highlighterMod !== null,
  );
  const code = String(children).replace(/\n$/, "");
  const match = /language-([\w+#.-]+)/.exec(className || "");
  const rawLang = match ? match[1] : "";
  const language = inferFenceLanguage(code, rawLang);
  const isDiff = language === "diff";
  const isMermaid = language === "mermaid";
  const langLabel = isDiff
    ? "diff"
    : isMermaid
      ? "mermaid"
      : language || "code";
  const langClass = langCssClass(language || "text");

  useEffect(() => {
    if (!highlighterReady) {
      loadHighlighter().then(() => setHighlighterReady(true));
    }
  }, [highlighterReady]);

  function handleCopy(): void {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fallbackPre = <pre className="md-code-fallback">{code}</pre>;

  return (
    <div className={`chat-code-block ${langClass}`}>
      <div className="chat-code-header">
        <span className={`chat-code-lang ${langClass}`}>{langLabel}</span>
        <button type="button" className="chat-code-copy" onClick={handleCopy}>
          {copied ? t("common.copied") : <Copy size={13} />}
        </button>
      </div>
      {isMermaid ? (
        <MermaidDiagram code={code} />
      ) : isDiff && workspaceRoot ? (
        <DiffApplyView code={code} workspaceRoot={workspaceRoot} />
      ) : isDiff ? (
        <DiffView code={code} />
      ) : highlighterReady && _highlighterMod ? (
        <_highlighterMod.Prism
          style={PRISM_BLOCK_STYLE}
          language={language || "text"}
          PreTag="div"
          codeTagProps={prismCodeTagProps(language)}
          {...PRISM_BLOCK_OPTIONS}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "13px",
            padding: "14px 16px",
            background: "transparent",
          }}
        >
          {code}
        </_highlighterMod.Prism>
      ) : (
        fallbackPre
      )}
    </div>
  );
}

function MarkdownBlockquote({
  children,
}: {
  children?: ReactNode;
}): React.JSX.Element {
  const callout = detectCallout(children);
  if (!callout) {
    return <blockquote className="md-quote">{children}</blockquote>;
  }
  return (
    <aside
      className={`md-callout md-callout--${callout.kind}`}
      role="note"
      aria-label={callout.title}
    >
      <div className="md-callout-head">
        <span className="md-callout-badge">{callout.title}</span>
      </div>
      <blockquote className="md-callout-body">
        {calloutBodyChildren(children, callout)}
      </blockquote>
    </aside>
  );
}

function MarkdownHeading({
  level,
  children,
  slugger,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  slugger: (text: string) => string;
}): React.JSX.Element {
  const id = slugger(cellTextContent(children));
  const cls = `md-heading md-heading--h${level}`;
  switch (level) {
    case 1:
      return (
        <h1 id={id} className={cls}>
          {children}
        </h1>
      );
    case 2:
      return (
        <h2 id={id} className={cls}>
          {children}
        </h2>
      );
    case 3:
      return (
        <h3 id={id} className={cls}>
          {children}
        </h3>
      );
    case 4:
      return (
        <h4 id={id} className={cls}>
          {children}
        </h4>
      );
    case 5:
      return (
        <h5 id={id} className={cls}>
          {children}
        </h5>
      );
    default:
      return (
        <h6 id={id} className={cls}>
          {children}
        </h6>
      );
  }
}

export type AgentMarkdownVariant = "chat" | "document";

const AgentMarkdown = memo(function AgentMarkdown({
  children,
  variant = "chat",
  className,
  workspaceRoot,
}: {
  children: string;
  variant?: AgentMarkdownVariant;
  className?: string;
  workspaceRoot?: string;
}): React.JSX.Element {
  const slugger = useMemo(() => createUniqueSlugger(), [children]);
  const rootClass = ["agent-markdown", `agent-markdown--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => {
            if (href?.startsWith("#")) {
              return (
                <a
                  href={href}
                  className="md-anchor-link"
                  onClick={(e) => {
                    e.preventDefault();
                    const root =
                      e.currentTarget.closest(".agent-markdown") ?? document;
                    scrollToMarkdownAnchor(root, href);
                  }}
                >
                  {linkChildren}
                </a>
              );
            }
            if (!isExternalHref(href || "")) {
              return <a href={href}>{linkChildren}</a>;
            }
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (!href) return;
                  window.hermesAPI.openExternal(href);
                }}
              >
                {linkChildren}
              </a>
            );
          },
          h1: ({ children: hChildren }) => (
            <MarkdownHeading level={1} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          h2: ({ children: hChildren }) => (
            <MarkdownHeading level={2} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          h3: ({ children: hChildren }) => (
            <MarkdownHeading level={3} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          h4: ({ children: hChildren }) => (
            <MarkdownHeading level={4} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          h5: ({ children: hChildren }) => (
            <MarkdownHeading level={5} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          h6: ({ children: hChildren }) => (
            <MarkdownHeading level={6} slugger={slugger}>
              {hChildren}
            </MarkdownHeading>
          ),
          img: ({ src }) => {
            if (typeof src !== "string" || src.length === 0) return null;
            const token = describeImageSrc(src);
            return token.isImage ? (
              <MediaImage token={token} />
            ) : (
              <DownloadChip token={token} />
            );
          },
          blockquote: ({ children: quoteChildren }) => (
            <MarkdownBlockquote>{quoteChildren}</MarkdownBlockquote>
          ),
          ul: ({ children: ulChildren }) => (
            <ul className="md-list md-list--unordered">{ulChildren}</ul>
          ),
          ol: ({ children: olChildren }) => (
            <ol className="md-list md-list--ordered">{olChildren}</ol>
          ),
          hr: () => <hr className="md-divider" />,
          table: ({ children: tableChildren }) => (
            <div className="md-table-wrap">
              <table className="md-table">{tableChildren}</table>
            </div>
          ),
          th: ({ children: thChildren }) => (
            <MarkdownTableCell isHeader>{thChildren}</MarkdownTableCell>
          ),
          td: ({ children: tdChildren }) => (
            <MarkdownTableCell isHeader={false}>{tdChildren}</MarkdownTableCell>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClass, children: codeChildren }) => {
            const isFenced = /language-/.test(codeClass || "");
            const text = String(codeChildren ?? "");
            const isInline = !isFenced && !text.includes("\n");
            if (isInline) {
              return <InlineCode text={text} workspaceRoot={workspaceRoot} />;
            }
            return (
              <CodeBlock className={codeClass} workspaceRoot={workspaceRoot}>
                {codeChildren}
              </CodeBlock>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
});

export { AgentMarkdown };
export default AgentMarkdown;
