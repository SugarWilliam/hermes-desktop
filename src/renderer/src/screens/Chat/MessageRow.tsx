import { memo, useMemo, useState } from "react";
import { AgentMarkdown } from "../../components/AgentMarkdown";
import { AttachmentChip } from "../../components/AttachmentChip";
import { MediaSegmentView } from "../../components/MediaImage";
import { useI18n } from "../../components/useI18n";
import { parseMediaTokens } from "./mediaUtils";
import { displayTextForUserMessage } from "./userMessageDisplay";
import { APPROVAL_RE } from "./messageApproval";
import type { Attachment, ChatBubbleMessage, ChatMessage } from "./types";

function isChatBubbleMessage(msg: ChatMessage): msg is ChatBubbleMessage {
  return (
    msg.kind === "user" ||
    msg.kind === "assistant" ||
    (!msg.kind && (msg.role === "user" || msg.role === "agent"))
  );
}

interface MessageRowProps {
  msg: ChatMessage;
  isLast: boolean;
  isLoading: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export const MessageRow = memo(function MessageRow({
  msg,
  isLast,
  isLoading,
  onApprove,
  onDeny,
}: MessageRowProps): React.JSX.Element {
  const { t } = useI18n();
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );

  const bubbleContent = isChatBubbleMessage(msg)
    ? (msg as ChatBubbleMessage).content
    : null;
  const segments = useMemo(
    () =>
      msg.role === "agent" && bubbleContent
        ? parseMediaTokens(bubbleContent)
        : null,
    [msg.role, bubbleContent],
  );

  if (!isChatBubbleMessage(msg)) {
    return <div className="chat-transcript-block chat-transcript-block--agent" />;
  }

  const showApprovalBar =
    msg.role === "agent" &&
    !isLoading &&
    isLast &&
    APPROVAL_RE.test(msg.content);
  const hasAttachments = !!msg.attachments && msg.attachments.length > 0;
  const userDisplayText =
    msg.role === "user" && bubbleContent
      ? displayTextForUserMessage(bubbleContent)
      : bubbleContent;

  return (
    <article
      className={`chat-transcript-block chat-transcript-block--${msg.role}`}
    >
      {hasAttachments && (
        <div className="chat-message-attachments">
          {msg.attachments!.map((att) => (
            <AttachmentChip
              key={att.id}
              attachment={att}
              onPreview={(a) => a.kind === "image" && setPreviewAttachment(a)}
            />
          ))}
        </div>
      )}
      <div className="chat-transcript-content chat-bubble">
        {msg.role === "user" ? (
          userDisplayText ? (
            <div className="chat-transcript-user-text">{userDisplayText}</div>
          ) : null
        ) : segments ? (
          segments.map((segment) =>
            segment.type === "text" ? (
              segment.value.trim() ? (
                <AgentMarkdown key={`t-${segment.start}`} variant="chat">
                  {segment.value}
                </AgentMarkdown>
              ) : null
            ) : (
              <MediaSegmentView
                key={`m-${segment.start}`}
                token={segment.token}
                raw={segment.raw}
                source={segment.source}
              />
            ),
          )
        ) : (
          <AgentMarkdown variant="chat">{msg.content}</AgentMarkdown>
        )}
      </div>
      {showApprovalBar && (
        <div className="chat-approval-bar">
          <button
            className="chat-approval-btn chat-approve"
            onClick={onApprove}
          >
            {t("chat.approve")}
          </button>
          <button className="chat-approval-btn chat-deny" onClick={onDeny}>
            {t("chat.deny")}
          </button>
        </div>
      )}
      {previewAttachment && previewAttachment.dataUrl && (
        <div
          className="chat-image-preview-backdrop"
          onClick={() => setPreviewAttachment(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={previewAttachment.dataUrl}
            alt={previewAttachment.name}
            className="chat-image-preview-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
});
