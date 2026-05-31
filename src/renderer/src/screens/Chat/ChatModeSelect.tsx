import { memo, useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Bot,
  ListTodo,
  Microscope,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../../components/useI18n";
import type { ChatMode } from "../../../../shared/chatMode";

const MODES: ChatMode[] = ["chat", "agent", "plan", "rigorous"];

const MODE_ICONS: Record<ChatMode, LucideIcon> = {
  chat: MessageSquare,
  agent: Bot,
  plan: ListTodo,
  rigorous: Microscope,
};

interface ChatModeSelectProps {
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
}

export const ChatModeSelect = memo(function ChatModeSelect({
  chatMode,
  onChatModeChange,
}: ChatModeSelectProps): React.JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ActiveIcon = MODE_ICONS[chatMode];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="chat-mode-select" ref={rootRef}>
      <button
        type="button"
        className="chat-mode-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={t(`chat.mode.${chatMode}Hint`)}
      >
        <ActiveIcon size={14} className="chat-mode-trigger-icon" aria-hidden />
        <span className="chat-mode-trigger-label">
          {t(`chat.mode.${chatMode}`)}
        </span>
        <ChevronDown size={12} className="chat-mode-trigger-chevron" aria-hidden />
      </button>

      {open && (
        <div className="chat-mode-dropdown" role="listbox">
          {MODES.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const active = chatMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={active}
                className={`chat-mode-option ${active ? "chat-mode-option--active" : ""}`}
                onClick={() => {
                  onChatModeChange(mode);
                  setOpen(false);
                }}
              >
                <Icon size={14} className="chat-mode-option-icon" aria-hidden />
                <span className="chat-mode-option-text">
                  <span className="chat-mode-option-label">
                    {t(`chat.mode.${mode}`)}
                  </span>
                  <span className="chat-mode-option-hint">
                    {t(`chat.mode.${mode}Hint`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
