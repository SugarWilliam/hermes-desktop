import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Send, Square as Stop, Slash, Paperclip, FileText } from "lucide-react";
import { isImeComposing } from "./keyboard";
import { useI18n } from "../../components/useI18n";
import { SLASH_COMMANDS, type SlashCommand } from "./slashCommands";
import { useInputHistory } from "./hooks/useInputHistory";
import {
  processFiles,
  filesFromClipboard,
  type AttachmentError,
} from "./attachmentUtils";
import { AttachmentChip } from "../../components/AttachmentChip";
import { PromptTemplatePicker } from "./PromptTemplatePicker";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  isTextFile,
  type Attachment,
} from "../../../../shared/attachments";

/** Must match `.chat-input` max-height in main.css */
const CHAT_INPUT_MAX_HEIGHT_PX = 200;
/** Must match `.chat-input` min-height in main.css */
const CHAT_INPUT_MIN_HEIGHT_PX = 40;

function resizeChatTextarea(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.overflowY = "hidden";
  const contentHeight = el.scrollHeight;
  const next = Math.min(
    Math.max(contentHeight, CHAT_INPUT_MIN_HEIGHT_PX),
    CHAT_INPUT_MAX_HEIGHT_PX,
  );
  el.style.height = `${next}px`;
  el.style.overflowY =
    contentHeight > CHAT_INPUT_MAX_HEIGHT_PX ? "auto" : "hidden";
}

export interface ChatInputHandle {
  setText(text: string): void;
  /** Append quoted context (from workspace panel or context menu). */
  appendText(text: string): void;
  /** One-line @-reference (folder / selection) — no code body. */
  appendReference(line: string): void;
  /** Attach workspace or picked file by path (inlines text files). */
  addPathRef(absolutePath: string): void;
  clear(): void;
  focus(): void;
  /** Add files from external sources (drop overlay).  Returns errors. */
  addFiles(files: File[] | FileList): Promise<AttachmentError[]>;
}

/** Called when an attachment is bound to a filesystem path (picker, drop, workspace). */
export type OnAttachmentPath = (absolutePath: string) => void;

interface ChatInputProps {
  isLoading: boolean;
  /** Layout session id — changes when user opens another saved chat. */
  conversationKey?: string | null;
  sessionId?: string | null;
  remoteMode?: boolean;
  onSubmit: (text: string, attachments: Attachment[]) => void;
  onAbort: () => void;
  /** Bind workspace context to the parent folder of attached files. */
  onAttachmentPath?: OnAttachmentPath;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      isLoading,
      conversationKey,
      sessionId,
      remoteMode,
      onSubmit,
      onAbort,
      onAttachmentPath,
    },
    ref,
  ): React.JSX.Element {
    const { t } = useI18n();
    const [input, setInput] = useState("");
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashFilter, setSlashFilter] = useState("");
    const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionResults, setMentionResults] = useState<string[]>([]);
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
    const [mentionDebounce, setMentionDebounce] = useState<ReturnType<
      typeof setTimeout
    > | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const slashMenuRef = useRef<HTMLDivElement>(null);
    const mentionMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const autoResize = useCallback((): void => {
      const el = inputRef.current;
      if (!el) return;
      resizeChatTextarea(el);
    }, []);

    const applyHistoryText = useCallback(
      (text: string): void => {
        setInput(text);
        requestAnimationFrame(() => {
          autoResize();
          inputRef.current?.setSelectionRange(text.length, text.length);
        });
      },
      [autoResize],
    );

    const history = useInputHistory({
      currentInput: input,
      applyText: applyHistoryText,
    });

    const formatError = useCallback(
      (err: AttachmentError): string => {
        switch (err.code) {
          case "too-many":
            return t("chat.attachTooMany");
          case "image-too-large":
            return t("chat.attachImageTooLarge", { name: err.filename });
          case "text-too-large":
            return t("chat.attachTextTooLarge", { name: err.filename });
          case "unsupported-type":
            return t("chat.attachUnsupported", { name: err.filename });
          case "read-failed":
            return t("chat.attachReadFailed", { name: err.filename });
          case "remote-mode-binary":
            return t("chat.attachRemoteModeBinary", { name: err.filename });
          default:
            return err.filename;
        }
      },
      [t],
    );

    const ingestFiles = useCallback(
      async (files: File[] | FileList): Promise<AttachmentError[]> => {
        const { attachments: added, errors } = await processFiles(
          files,
          attachments.length,
          {
            sessionId: sessionId || undefined,
            remoteMode: !!remoteMode,
          },
        );
        if (added.length > 0) {
          for (const att of added) {
            if (att.path) onAttachmentPath?.(att.path);
          }
          setAttachments((prev) => [...prev, ...added]);
        }
        if (errors.length > 0) {
          setAttachmentError(formatError(errors[0]));
        } else {
          setAttachmentError(null);
        }
        return errors;
      },
      [
        attachments.length,
        formatError,
        sessionId,
        remoteMode,
        onAttachmentPath,
      ],
    );

    useImperativeHandle(
      ref,
      () => ({
        setText(text: string): void {
          setInput(text);
          requestAnimationFrame(() => {
            autoResize();
            if (inputRef.current) {
              inputRef.current.setSelectionRange(text.length, text.length);
              inputRef.current.focus();
            }
          });
        },
        appendText(fragment: string): void {
          setInput((prev) => {
            const block = fragment.trim();
            if (!block) return prev;
            const sep = prev.trim() ? "\n\n" : "";
            return `${prev}${sep}${block}\n`;
          });
          requestAnimationFrame(() => {
            autoResize();
            inputRef.current?.focus();
          });
        },
        appendReference(line: string): void {
          const ref = line.trim();
          if (!ref) return;
          setInput((prev) => {
            const sep = prev.trim() ? " " : "";
            return `${prev}${sep}${ref}`;
          });
          requestAnimationFrame(() => {
            autoResize();
            inputRef.current?.focus();
          });
        },
        addPathRef(absolutePath: string): void {
          const name =
            absolutePath.split(/[\\/]/).filter(Boolean).pop() || absolutePath;
          void (async (): Promise<void> => {
            if (isTextFile("", name)) {
              try {
                const { content, truncated } =
                  await window.hermesAPI.readAttachmentFile(absolutePath);
                setAttachments((prev) => {
                  if (prev.some((a) => a.path === absolutePath)) return prev;
                  if (prev.length >= MAX_ATTACHMENTS_PER_MESSAGE) return prev;
                  const att: Attachment = {
                    id: `text-${Date.now()}-${prev.length}`,
                    kind: "text-file",
                    name,
                    mime: name.endsWith(".md") ? "text/markdown" : "text/plain",
                    size: content.length,
                    text: truncated
                      ? `${content}\n\n[File truncated for preview — full path: ${absolutePath}]`
                      : content,
                    path: absolutePath,
                  };
                  onAttachmentPath?.(absolutePath);
                  return [...prev, att];
                });
                setAttachmentError(null);
                requestAnimationFrame(() => inputRef.current?.focus());
                return;
              } catch {
                /* fall through to path-ref */
              }
            }
            setAttachments((prev) => {
              if (prev.some((a) => a.path === absolutePath)) return prev;
              if (prev.length >= MAX_ATTACHMENTS_PER_MESSAGE) return prev;
              const att: Attachment = {
                id: `path-${Date.now()}-${prev.length}`,
                kind: "path-ref",
                name,
                mime: "application/octet-stream",
                size: 0,
                path: absolutePath,
              };
              onAttachmentPath?.(absolutePath);
              return [...prev, att];
            });
            setAttachmentError(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          })();
        },
        clear(): void {
          setInput("");
          setAttachments([]);
          setAttachmentError(null);
          requestAnimationFrame(() => {
            if (inputRef.current) resizeChatTextarea(inputRef.current);
          });
        },
        focus(): void {
          inputRef.current?.focus();
        },
        addFiles(files: File[] | FileList): Promise<AttachmentError[]> {
          return ingestFiles(files);
        },
      }),
      [autoResize, ingestFiles, onAttachmentPath],
    );

    // Clear draft and attachments when switching to another saved session.
    useEffect(() => {
      setInput("");
      setAttachments([]);
      setAttachmentError(null);
      requestAnimationFrame(() => {
        if (inputRef.current) resizeChatTextarea(inputRef.current);
      });
    }, [conversationKey]);

    // Keep height in sync when input is set programmatically (append, history, etc.)
    useEffect(() => {
      autoResize();
    }, [input, autoResize]);

    // Refocus the textarea when a streaming response ends
    useEffect(() => {
      if (!isLoading) inputRef.current?.focus();
    }, [isLoading]);

    // Close slash menu on click outside
    useEffect(() => {
      if (!slashMenuOpen) return;
      function handleClickOutside(e: MouseEvent): void {
        if (
          slashMenuRef.current &&
          !slashMenuRef.current.contains(e.target as Node)
        ) {
          setSlashMenuOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [slashMenuOpen]);

    // Scroll active slash menu item into view
    useEffect(() => {
      if (!slashMenuOpen) return;
      const active = slashMenuRef.current?.querySelector(
        ".slash-menu-item-active",
      );
      active?.scrollIntoView({ block: "nearest" });
    }, [slashSelectedIndex, slashMenuOpen]);

    const filteredSlashCommands = useMemo(
      () =>
        slashMenuOpen
          ? SLASH_COMMANDS.filter((cmd) =>
              cmd.name.toLowerCase().startsWith(slashFilter.toLowerCase()),
            )
          : [],
      [slashMenuOpen, slashFilter],
    );

    function clearAfterSend(text: string): void {
      history.push(text);
      setInput("");
      setAttachments([]);
      setAttachmentError(null);
      requestAnimationFrame(() => {
        if (inputRef.current) resizeChatTextarea(inputRef.current);
      });
    }

    function handleSend(): void {
      const text = input.trim();
      const hasPayload = text.length > 0 || attachments.length > 0;
      if (!hasPayload) return;
      setSlashMenuOpen(false);
      const sendAttachments = attachments;
      clearAfterSend(text);
      onSubmit(text, sendAttachments);
    }

    function handleTemplateSelect(content: string): void {
      setInput((prev) => (prev ? prev + "\n" + content : content));
      setTemplatePickerOpen(false);
      requestAnimationFrame(() => {
        if (inputRef.current) resizeChatTextarea(inputRef.current);
        inputRef.current?.focus();
      });
    }

    function handleSlashSelect(cmd: SlashCommand): void {
      setSlashMenuOpen(false);
      // Local / info commands dispatch immediately — let parent route through onSubmit
      if (cmd.local || cmd.category === "info") {
        setInput("");
        requestAnimationFrame(() => {
          if (inputRef.current) resizeChatTextarea(inputRef.current);
        });
        onSubmit(cmd.name, []);
        return;
      }
      // Backend commands that take arguments: insert prefix and wait for the user
      setInput(cmd.name + " ");
      inputRef.current?.focus();
    }

    // @-mention file search
    const searchMentionFiles = useCallback(async (query: string) => {
      try {
        const results = await window.hermesAPI.searchWorkspaceFiles(".", query);
        setMentionResults(results);
      } catch {
        setMentionResults([]);
      }
    }, []);

    const selectMention = useCallback(
      (path: string) => {
        const el = inputRef.current;
        if (!el) return;
        const cursorPos = el.selectionStart || input.length;
        const textBeforeCursor = input.slice(0, cursorPos);
        const textAfterCursor = input.slice(cursorPos);
        const atIdx = textBeforeCursor.lastIndexOf("@");
        if (atIdx === -1) return;
        const newText =
          textBeforeCursor.slice(0, atIdx) + "@" + path + " " + textAfterCursor;
        setInput(newText);
        setMentionOpen(false);
        setMentionResults([]);
        requestAnimationFrame(() => {
          const el2 = inputRef.current;
          if (el2) {
            const newPos = atIdx + 1 + path.length + 1;
            el2.focus();
            el2.selectionStart = el2.selectionEnd = newPos;
            resizeChatTextarea(el2);
          }
        });
      },
      [input],
    );

    const dismissMention = useCallback(() => {
      setMentionOpen(false);
      setMentionResults([]);
      setMentionQuery("");
    }, []);

    function handleInputChange(
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ): void {
      const value = e.target.value;
      setInput(value);

      requestAnimationFrame(() => resizeChatTextarea(e.target));

      // Slash command detection
      if (value.startsWith("/") && !value.includes(" ")) {
        const query = value.split(" ")[0];
        setSlashMenuOpen(true);
        setSlashFilter(query);
        setSlashSelectedIndex(0);
      } else if (slashMenuOpen) {
        setSlashMenuOpen(false);
      }

      // @-mention file search detection
      const cursorPos = e.target.selectionStart || value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\S*)$/);
      if (atMatch) {
        const query = atMatch[1];
        setMentionOpen(true);
        setMentionQuery(query);
        if (mentionDebounce) clearTimeout(mentionDebounce);
        const debounce = setTimeout(() => {
          void searchMentionFiles(query);
        }, 200);
        setMentionDebounce(debounce);
      } else if (mentionOpen) {
        dismissMention();
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
      if (isImeComposing(e)) return;

      // Slash menu keyboard navigation
      if (slashMenuOpen && filteredSlashCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashSelectedIndex((i) =>
            i < filteredSlashCommands.length - 1 ? i + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredSlashCommands.length - 1,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleSlashSelect(filteredSlashCommands[slashSelectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenuOpen(false);
          return;
        }
      }

      // @-mention keyboard navigation
      if (mentionOpen && mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionSelectedIndex((i) =>
            i < mentionResults.length - 1 ? i + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionSelectedIndex((i) =>
            i > 0 ? i - 1 : mentionResults.length - 1,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(mentionResults[mentionSelectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          dismissMention();
          return;
        }
      }

      // @-mention keyboard navigation
      if (mentionOpen && mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionSelectedIndex((i) =>
            i < mentionResults.length - 1 ? i + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionSelectedIndex((i) =>
            i > 0 ? i - 1 : mentionResults.length - 1,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(mentionResults[mentionSelectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          dismissMention();
          return;
        }
      }

      // History navigation: ArrowUp/Down when not in a multiline draft (or already navigating)
      if (
        !slashMenuOpen &&
        !mentionOpen &&
        (history.isNavigating() || !input.includes("\n"))
      ) {
        if (e.key === "ArrowUp" && history.size() > 0) {
          if (history.recallPrev()) {
            e.preventDefault();
            return;
          }
        }
        if (e.key === "ArrowDown" && history.isNavigating()) {
          if (history.recallNext()) {
            e.preventDefault();
            return;
          }
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
      const { files, hasText } = filesFromClipboard(e);
      if (files.length === 0) return;
      // If there's also text, let the textarea handle the text portion
      // normally; we still consume the files (browser delivers both).
      if (!hasText) e.preventDefault();
      void ingestFiles(files);
    }

    async function handleFileInputChange(
      e: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await ingestFiles(files);
      // Reset so the same file can be picked again later
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function removeAttachment(id: string): void {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      setAttachmentError(null);
    }

    const canSend = input.trim().length > 0 || attachments.length > 0;

    return (
      <>
        {mentionOpen && mentionResults.length > 0 && (
          <div className="slash-menu" ref={mentionMenuRef}>
            <div className="slash-menu-header">
              <Paperclip size={12} />
              {"Files matching @" + mentionQuery}
            </div>
            <div className="slash-menu-list">
              {mentionResults.map((path, i) => {
                const name = path.split("/").filter(Boolean).pop() || path;
                return (
                  <button
                    key={path}
                    className={`slash-menu-item ${i === mentionSelectedIndex ? "slash-menu-item-active" : ""}`}
                    onMouseEnter={() => setMentionSelectedIndex(i)}
                    onClick={() => selectMention(path)}
                  >
                    <span className="slash-menu-item-name">{name}</span>
                    <span className="slash-menu-item-desc">{path}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {slashMenuOpen && filteredSlashCommands.length > 0 && (
          <div className="slash-menu" ref={slashMenuRef}>
            <div className="slash-menu-header">
              <Slash size={12} />
              {t("chat.commandsTitle")}
            </div>
            <div className="slash-menu-list">
              {filteredSlashCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  className={`slash-menu-item ${i === slashSelectedIndex ? "slash-menu-item-active" : ""}`}
                  onMouseEnter={() => setSlashSelectedIndex(i)}
                  onClick={() => handleSlashSelect(cmd)}
                >
                  <span className="slash-menu-item-name">{cmd.name}</span>
                  <span className="slash-menu-item-desc">
                    {cmd.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <PromptTemplatePicker
          open={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={handleTemplateSelect}
        />
        {(attachments.length > 0 || attachmentError) && (
          <div className="chat-attachment-strip">
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
            {attachmentError && (
              <div className="chat-attachment-error" role="alert">
                {attachmentError}
              </div>
            )}
          </div>
        )}
        <div className="chat-input-wrapper">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />
          <button
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title={t("chat.attach")}
            aria-label={t("chat.attach")}
            type="button"
          >
            <Paperclip size={16} />
          </button>
          <button
            className="chat-attach-btn"
            onClick={() => setTemplatePickerOpen(!templatePickerOpen)}
            disabled={isLoading}
            title={t("chat.templates.title")}
            type="button"
          >
            <FileText size={16} />
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={t("chat.typeMessage")}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            autoFocus
          />
          {isLoading ? (
            <button
              className="chat-send-btn chat-stop-btn"
              onClick={onAbort}
              title={t("common.stop")}
            >
              <Stop size={14} />
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!canSend}
              title={t("chat.send")}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </>
    );
  },
);
