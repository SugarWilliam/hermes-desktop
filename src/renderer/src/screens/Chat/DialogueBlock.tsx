import { memo, useMemo } from "react";
import { FileText } from "lucide-react";
import { AttachmentChip } from "../../components/AttachmentChip";
import { useI18n } from "../../components/useI18n";
import { displayTextForUserMessage } from "./userMessageDisplay";
import { extractWorkspaceReferenceFromBlock } from "../../../../shared/workspaceContext";
import type { ChatBubbleMessage } from "./types";

function fileNameFromPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

interface DialogueBlockProps {
  msg: ChatBubbleMessage;
}

export const DialogueBlock = memo(function DialogueBlock({
  msg,
}: DialogueBlockProps): React.JSX.Element {
  const { t } = useI18n();
  const displayText = useMemo(
    () => displayTextForUserMessage(msg.content),
    [msg.content],
  );

  const pathRefs = useMemo(() => {
    const refs: string[] = [];
    const attNames = new Set(
      (msg.attachments ?? []).map((a) => a.name.toLowerCase()),
    );
    const folder = extractWorkspaceReferenceFromBlock(msg.content);
    if (folder) refs.push(folder);
    const fileMatch = msg.content.match(/Context from (?:file )?`([^`]+)`/i);
    if (fileMatch) {
      const name = fileNameFromPath(fileMatch[1]);
      if (!attNames.has(name.toLowerCase())) refs.push(fileMatch[1]);
    }
    return refs;
  }, [msg.content, msg.attachments]);

  const hasAttachments = !!msg.attachments?.length;

  return (
    <section className="paradigm-dialogue" aria-label={t("chat.phase.dialogue")}>
      <div className="paradigm-dialogue-row">
        {hasAttachments &&
          msg.attachments!.map((att) => (
            <span key={att.id} className="paradigm-file-chip">
              <FileText size={14} className="paradigm-file-chip-icon" aria-hidden />
              <span className="paradigm-file-chip-name">{att.name}</span>
            </span>
          ))}
        {pathRefs.map((p) => (
          <span key={p} className="paradigm-file-chip">
            <FileText size={14} className="paradigm-file-chip-icon" aria-hidden />
            <span className="paradigm-file-chip-name">{fileNameFromPath(p)}</span>
          </span>
        ))}
        {(hasAttachments || pathRefs.length > 0) && !displayText && (
          <span className="paradigm-dialogue-action">
            {t("chat.phase.evaluateFile")}
          </span>
        )}
      </div>
      {displayText ? (
        <div className="paradigm-dialogue-text">{displayText}</div>
      ) : null}
      {hasAttachments && displayText && (
        <div className="paradigm-dialogue-attachments">
          {msg.attachments!.map((att) => (
            <AttachmentChip key={att.id} attachment={att} />
          ))}
        </div>
      )}
    </section>
  );
});
