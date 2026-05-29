import { memo, useEffect, useState } from "react";
import { ThinkingView } from "./ThinkingView";
import { useI18n } from "../../components/useI18n";
import { AttachmentChip } from "../../components/AttachmentChip";
import type {
  Attachment,
  ReasoningMessage,
  ToolCallMessage,
  ToolResultMessage,
} from "./types";

/* ── Shared primitive ─────────────────────────────────────────────────── */

interface CollapsibleSectionProps {
  variant: "reasoning" | "tool-call" | "tool-result";
  header: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Chevron = memo(function Chevron({
  open,
}: {
  open: boolean;
}): React.JSX.Element {
  return (
    <span
      className={`chat-history-chevron ${
        open ? "chat-history-chevron--open" : ""
      }`}
      aria-hidden="true"
    >
      ▸
    </span>
  );
});

const CollapsibleSection = memo(function CollapsibleSection({
  variant,
  header,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  return (
    <details
      className={`chat-history chat-history--${variant}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="chat-history-header">
        <Chevron open={open} />
        {header}
      </summary>
      <div className="chat-history-body">{children}</div>
    </details>
  );
});

/* ── Reasoning ────────────────────────────────────────────────────────── */

export const ReasoningRow = memo(function ReasoningRow({
  msg,
  defaultOpen = false,
}: {
  msg: ReasoningMessage;
  defaultOpen?: boolean;
}): React.JSX.Element {
  const { t } = useI18n();
  const lineCount = msg.text.split("\n").length;
  return (
    <div className="chat-transcript-block chat-transcript-block--agent chat-message-history">
      <CollapsibleSection
        variant="reasoning"
        defaultOpen={defaultOpen}
        header={
          <span className="chat-history-label">
            <span className="chat-history-title">{t("chat.thinking")}</span>
            <span className="chat-history-meta">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </span>
        }
      >
        <div className="chat-history-markdown">
          <ThinkingView text={msg.text} />
        </div>
      </CollapsibleSection>
    </div>
  );
});

/* ── Tool call ────────────────────────────────────────────────────────── */

function summariseArgs(args: string): string {
  // Single-line snippet for the collapsed header — show the first ~80
  // chars, collapse whitespace so multi-line JSON doesn't break layout.
  const flat = args.replace(/\s+/g, " ").trim();
  if (flat.length <= 80) return flat;
  return flat.slice(0, 77) + "…";
}

export const ToolCallRow = memo(function ToolCallRow({
  msg,
  defaultOpen = false,
}: {
  msg: ToolCallMessage;
  defaultOpen?: boolean;
}): React.JSX.Element {
  const { t } = useI18n();
  const summary = summariseArgs(msg.args);
  return (
    <div className="chat-transcript-block chat-transcript-block--agent chat-message-history">
      <CollapsibleSection
        variant="tool-call"
        defaultOpen={defaultOpen}
        header={
          <span className="chat-history-label">
            <span className="chat-history-title">{t("chat.toolCall")}</span>
            <span className="chat-history-tool-name">{msg.name}</span>
            {summary && (
              <span className="chat-history-tool-summary">{summary}</span>
            )}
          </span>
        }
      >
        <pre className="chat-history-pre chat-history-pre--code">
          {msg.args || "(no arguments)"}
        </pre>
      </CollapsibleSection>
    </div>
  );
});

/* ── Tool result ──────────────────────────────────────────────────────── */

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

export const ToolResultRow = memo(function ToolResultRow({
  msg,
}: {
  msg: ToolResultMessage;
}): React.JSX.Element {
  const { t } = useI18n();
  const lines = countLines(msg.content);
  const hasAttachments = !!msg.attachments && msg.attachments.length > 0;
  return (
    <div className="chat-transcript-block chat-transcript-block--agent chat-message-history">
      <CollapsibleSection
        variant="tool-result"
        header={
          <span className="chat-history-label">
            <span className="chat-history-title">{t("chat.toolResult")}</span>
            <span className="chat-history-tool-name">{msg.name}</span>
            <span className="chat-history-meta">
              {lines} {lines === 1 ? "line" : "lines"}
              {hasAttachments
                ? ` · ${msg.attachments!.length} attachment${
                    msg.attachments!.length === 1 ? "" : "s"
                  }`
                : ""}
            </span>
          </span>
        }
      >
        {hasAttachments && (
          <div className="chat-history-attachments">
            {msg.attachments!.map((att: Attachment) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}
        <pre className="chat-history-pre chat-history-pre--scroll">
          {msg.content || "(empty)"}
        </pre>
      </CollapsibleSection>
    </div>
  );
});
