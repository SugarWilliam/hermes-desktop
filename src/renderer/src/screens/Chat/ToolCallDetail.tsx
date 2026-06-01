import { memo, useState, useMemo } from "react";
import { ChevronDown, Code2, FileOutput } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface ToolCallDetailProps {
  args?: string;
  result?: string;
}

/** Try to pretty-print JSON; fall back to raw string. */
function tryFormatJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
}

/** Truncate long strings for display; show "Expand" button when truncated. */
function TruncatedText({
  text,
  maxLen = 300,
}: {
  text: string;
  maxLen?: number;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLen;
  const displayed = needsTruncation && !expanded ? text.slice(0, maxLen) + "…" : text;

  return (
    <div className="paradigm-tool-detail-text">
      <pre>{displayed}</pre>
      {needsTruncation && (
        <button
          type="button"
          className="paradigm-tool-detail-expand"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export const ToolCallDetail = memo(function ToolCallDetail({
  args,
  result,
}: ToolCallDetailProps): React.JSX.Element | null {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const formattedArgs = useMemo(
    () => (args ? tryFormatJson(args) : null),
    [args],
  );
  const formattedResult = useMemo(
    () => (result ? tryFormatJson(result) : null),
    [result],
  );

  if (!formattedArgs && !formattedResult) return null;

  return (
    <div className="paradigm-tool-detail">
      <button
        type="button"
        className="paradigm-tool-detail-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Code2 size={11} className="paradigm-tool-detail-icon" />
        <span>{t("chat.toolDetails")}</span>
        <ChevronDown
          size={11}
          className={`paradigm-tool-detail-chevron ${open ? "paradigm-tool-detail-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div className="paradigm-tool-detail-body">
          {formattedArgs && (
            <div className="paradigm-tool-detail-section">
              <div className="paradigm-tool-detail-label">
                <Code2 size={10} />
                {t("chat.toolArgs")}
              </div>
              <TruncatedText text={formattedArgs} />
            </div>
          )}
          {formattedResult && (
            <div className="paradigm-tool-detail-section">
              <div className="paradigm-tool-detail-label">
                <FileOutput size={10} />
                {t("chat.toolResult")}
              </div>
              <TruncatedText text={formattedResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
});
