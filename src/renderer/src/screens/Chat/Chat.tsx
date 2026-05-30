import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStreamGuard } from "./streamGuard";
import {
  CHAT_MODE_STORAGE_KEY,
  isPlanReadyForApproval,
  shouldSuggestPlanMode,
  type ChatMode,
} from "../../../../shared/chatMode";
import {
  parentDirectory,
  resolvePathUnderRoot,
} from "../../../../shared/pathUtils";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ChatHeader } from "./ChatHeader";
import { WorkspacePanel } from "./WorkspacePanel";
import { ChatSplitResizer } from "./ChatSplitResizer";
import { readChatPaneWidth } from "./chatPaneWidth";
import { ChatEmptyState } from "./ChatEmptyState";
import { MessageList } from "./MessageList";
import { ModelPicker } from "./ModelPicker";
import { ChatModeSelect } from "./ChatModeSelect";
import { useChatScroll } from "./hooks/useChatScroll";
import { useChatIPC } from "./hooks/useChatIPC";
import { useLiveSessionSync } from "./hooks/useLiveSessionSync";
import { useChatActions } from "./hooks/useChatActions";
import { useStreamStall } from "./hooks/useStreamStall";
import { useModelConfig } from "./hooks/useModelConfig";
import { useFastMode } from "./hooks/useFastMode";
import { useLocalCommands } from "./hooks/useLocalCommands";
import { useI18n } from "../../components/useI18n";
import { buildChatTranscript } from "./transcriptUtils";
import { extractWorkspaceReferenceFromBlock } from "../../../../shared/workspaceContext";
import type { Attachment } from "../../../../shared/attachments";
import type { ChatMessage, UsageState } from "./types";

interface QueuedMessage {
  text: string;
  attachments: Attachment[];
}

export type { ChatMessage } from "./types";

interface ChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sessionId: string | null;
  /** Layout-owned key; changes only on new chat / resume, not gateway session re-key. */
  conversationKey: number;
  profile?: string;
  onSessionIdChange?: (sessionId: string) => void;
  onSessionStarted?: () => void;
  onNewChat?: () => void;
}

function Chat({
  messages,
  setMessages,
  sessionId,
  conversationKey,
  profile,
  onSessionIdChange,
  onSessionStarted,
  onNewChat,
}: ChatProps): React.JSX.Element {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [hermesSessionId, setHermesSessionId] = useState<string | null>(null);
  const [toolProgress, setToolProgress] = useState<string | null>(null);
  const [toolProgressLog, setToolProgressLog] = useState<string[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [remoteMode, setRemoteMode] = useState(false);
  // Working folder bound to this conversation (issue #27). Per-conversation,
  // held in memory; reset on session switch / new chat below.
  const [contextFolder, setContextFolder] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    try {
      const stored = sessionStorage.getItem(CHAT_MODE_STORAGE_KEY);
      if (stored === "chat" || stored === "agent" || stored === "plan") {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return "agent";
  });
  const [planSuggestion, setPlanSuggestion] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [chatPaneWidth, setChatPaneWidth] = useState(readChatPaneWidth);
  const dragCounter = useRef(0);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const queueRef = useRef<QueuedMessage[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const hermesSessionIdRef = useRef<string | null>(null);

  const streamGuard = useMemo(
    () => createStreamGuard(() => hermesSessionIdRef.current),
    [],
  );

  useEffect(() => {
    hermesSessionIdRef.current = hermesSessionId;
  }, [hermesSessionId]);

  const bindSessionId = useCallback((id: string) => {
    hermesSessionIdRef.current = id;
  }, []);

  const resetTransientChatState = useCallback(() => {
    streamGuard.invalidate();
    window.hermesAPI.abortChat();
    setIsLoading(false);
    setToolProgress(null);
    setToolProgressLog([]);
    setUsage(null);
    setPlanSuggestion(null);
    chatInputRef.current?.clear();
  }, [streamGuard]);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      const flag = await window.hermesAPI.isRemoteMode();
      if (!cancelled) setRemoteMode(flag);
    })();
    return (): void => {
      cancelled = true;
    };
  }, []);

  const { containerRef, bottomRef } = useChatScroll(messages);
  const modelConfig = useModelConfig(profile);
  const {
    fastMode,
    toggle: toggleFastMode,
    set: setFastTier,
  } = useFastMode(profile);

  useChatIPC({
    setMessages,
    setHermesSessionId,
    setToolProgress,
    setToolProgressLog,
    setIsLoading,
    setUsage,
    streamGuard,
    bindSessionId,
  });

  useLiveSessionSync({
    isLoading,
    sessionId: hermesSessionId,
    chatMode,
    setMessages,
    streamGuard,
  });

  const streamStall = useStreamStall({
    isLoading,
    messages,
    toolProgress,
    toolProgressLog,
  });

  useEffect(() => {
    if (hermesSessionId) onSessionIdChange?.(hermesSessionId);
  }, [hermesSessionId, onSessionIdChange]);

  // Reset hermes session when the parent clears messages (new chat).
  // Effect-driven sync because `messages` is owned by the parent; a key-based
  // remount would discard unrelated local state (model picker, etc.).
  useEffect(() => {
    if (messages.length === 0) {
      setHermesSessionId(null);
      setContextFolder(null);
      queueRef.current = [];
      setQueuedCount(0);
    }
  }, [messages]);

  // Reset per-conversation UI when the user opens a new chat or resumes another
  // session. Do NOT key this on `sessionId` alone — the gateway may re-key the
  // same turn (desk-* → timestamp id after compression) and that must not
  // clear the workspace or abort the stream.
  useEffect(() => {
    resetTransientChatState();
    setHermesSessionId(sessionId);
    hermesSessionIdRef.current = sessionId;
    setContextFolder(null);
    queueRef.current = [];
    setQueuedCount(0);
    // conversationKey only — not sessionId (gateway re-key must not re-run this).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionId is read from the render when conversationKey changes.
  }, [conversationKey, resetTransientChatState]);

  // Keep gateway session id in sync when the parent list highlights a new id
  // for the same conversation (desk-* → canonical id after compression).
  useEffect(() => {
    if (!sessionId || sessionId === hermesSessionIdRef.current) return;
    bindSessionId(sessionId);
    setHermesSessionId(sessionId);
  }, [sessionId, bindSessionId]);

  // Cmd/Ctrl+N → new chat
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        onNewChat?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewChat]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_MODE_STORAGE_KEY, chatMode);
    } catch {
      /* ignore */
    }
  }, [chatMode]);

  // Auto-open workspace when a context folder is bound (Cursor / Qoder style).
  useEffect(() => {
    if (contextFolder && !remoteMode) {
      setWorkspaceOpen(true);
    } else if (!contextFolder) {
      setWorkspaceOpen(false);
    }
  }, [contextFolder, remoteMode]);

  // "Copy entire chat" context-menu items (issue #298) — serialise the whole
  // conversation in the requested format and copy it. A ref keeps the latest
  // messages without re-registering the IPC listener on every chunk.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });
  useEffect(() => {
    return window.hermesAPI.onContextMenuCopyChat((format) => {
      const msgs = messagesRef.current;
      if (msgs.length === 0) return;
      void window.hermesAPI.copyToClipboard(buildChatTranscript(msgs, format));
    });
  }, []);

  // "Select All" on a message (issue #298): the native selectAll role would
  // select the entire window, so scope it to the .chat-bubble under the
  // cursor — the user can then Copy that message.
  useEffect(() => {
    return window.hermesAPI.onContextMenuSelectBubble(({ x, y }) => {
      const bubble = document.elementFromPoint(x, y)?.closest(
        ".chat-transcript-content, .chat-bubble",
      );
      if (!bubble) return;
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.selectAllChildren(bubble);
    });
  }, []);

  useEffect(() => {
    return window.hermesAPI.onContextMenuAddToChat((text) => {
      const ref = extractWorkspaceReferenceFromBlock(text);
      if (ref) {
        chatInputRef.current?.appendReference(ref);
        return;
      }
      chatInputRef.current?.appendText(text);
    });
  }, []);

  const addAgentMessage = useCallback(
    (content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: `agent-local-${Date.now()}`, role: "agent", content },
      ]);
    },
    [setMessages],
  );

  const handleClear = useCallback(() => {
    streamGuard.invalidate();
    if (isLoading) {
      window.hermesAPI.abortChat();
      setIsLoading(false);
    }
    const idToDelete = hermesSessionId ?? sessionId;
    if (idToDelete) {
      void window.hermesAPI.deleteSession(idToDelete);
      void window.hermesAPI.clearStagedAttachments(idToDelete);
    }
    setMessages([]);
    setHermesSessionId(null);
    setContextFolder(null);
    setUsage(null);
    setToolProgress(null);
    queueRef.current = [];
    setQueuedCount(0);
  }, [isLoading, hermesSessionId, sessionId, setMessages, streamGuard]);

  const localCommands = useLocalCommands({
    profile,
    usage,
    setFastMode: setFastTier,
    onNewChat,
    onClear: handleClear,
    addAgentMessage,
  });

  const actions = useChatActions({
    profile,
    hermesSessionId,
    setHermesSessionId,
    messages,
    isLoading,
    setIsLoading,
    setMessages,
    onSessionStarted,
    chatInputRef,
    localCommands,
    contextFolder,
    chatMode,
    streamGuard,
    bindSessionId,
  });

  // Stable ref to handleSend so the drain effect doesn't re-trigger on
  // identity changes (regression #5 from PR #315).
  const handleSendRef = useRef(actions.handleSend);
  useEffect(() => {
    handleSendRef.current = actions.handleSend;
  });

  // Drain queued messages one at a time when the agent finishes.
  useEffect(() => {
    if (isLoading) return;
    const next = queueRef.current.shift();
    if (!next) return;
    setQueuedCount(queueRef.current.length);
    handleSendRef.current(next.text, next.attachments, true).catch(() => {
      // Put the message back at the front so it isn't silently lost if
      // the send fails (e.g. IPC error before onChatError fires).
      queueRef.current.unshift(next);
      setQueuedCount(queueRef.current.length);
    });
  }, [isLoading]);

  const handleAbort = useCallback(() => {
    actions.handleAbort();
    setToolProgress(null);
    setToolProgressLog([]);
  }, [actions]);

  const handleSubmitOrQueue = useCallback(
    (text: string, attachments: Attachment[]) => {
      if (
        chatMode !== "plan" &&
        shouldSuggestPlanMode(text) &&
        planSuggestion !== text
      ) {
        setPlanSuggestion(text);
      } else if (planSuggestion && planSuggestion !== text) {
        setPlanSuggestion(null);
      }
      if (isLoading) {
        queueRef.current.push({ text, attachments });
        setQueuedCount(queueRef.current.length);
        return;
      }
      setToolProgress(null);
      setToolProgressLog([]);
      void handleSendRef.current(text, attachments);
    },
    [isLoading, chatMode, planSuggestion],
  );

  const bindContextFromAttachmentPath = useCallback(
    (filePath: string) => {
      if (remoteMode) return;
      const resolved = resolvePathUnderRoot(filePath, contextFolder);
      const parent = parentDirectory(resolved);
      if (parent) setContextFolder((prev) => prev ?? parent);
      else if (contextFolder) setContextFolder((prev) => prev ?? contextFolder);
    },
    [remoteMode, contextFolder],
  );

  const handleAddFileRef = useCallback(
    (filePath: string) => {
      const resolved = resolvePathUnderRoot(filePath, contextFolder);
      bindContextFromAttachmentPath(resolved);
      chatInputRef.current?.addPathRef(resolved);
      chatInputRef.current?.focus();
    },
    [bindContextFromAttachmentPath, contextFolder],
  );

  const handleAppendReference = useCallback((line: string) => {
    chatInputRef.current?.appendReference(line);
    chatInputRef.current?.focus();
  }, []);

  const showWorkspace =
    workspaceOpen && !!contextFolder && !remoteMode;

  const planReadyForApproval = useMemo(
    () => isPlanReadyForApproval(messages, isLoading, chatMode),
    [messages, isLoading, chatMode],
  );

  const handlePlanApproveAndRun = useCallback(() => {
    setChatMode("agent");
    void handleSendRef.current(
      t("chat.planApproveMessage"),
      [],
      true,
      "agent",
    );
  }, [t]);

  const handleSuggestion = useCallback((text: string) => {
    chatInputRef.current?.setText(text);
  }, []);

  const handlePickFolder = useCallback(async () => {
    const path = await window.hermesAPI.selectFolder();
    if (path) setContextFolder(path);
  }, []);

  const handleClearFolder = useCallback(() => {
    setContextFolder(null);
  }, []);

  // Drag-and-drop: filter for dragenter events carrying files (suppresses
  // text-drag noise from the textarea autocomplete and other in-app drags).
  const eventHasFiles = useCallback((e: React.DragEvent): boolean => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === "Files") return true;
    }
    return false;
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      dragCounter.current += 1;
      if (dragCounter.current === 1) setDragActive(true);
    },
    [eventHasFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    [eventHasFiles],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      for (const file of files) {
        const path = (file as File & { path?: string }).path;
        if (path) bindContextFromAttachmentPath(path);
      }
      void chatInputRef.current?.addFiles(files);
    },
    [eventHasFiles, bindContextFromAttachmentPath],
  );

  return (
    <div
      className={`chat-layout ${showWorkspace ? "chat-layout--split" : ""}`}
    >
    <div
      className="chat-container"
      style={
        showWorkspace
          ? { width: chatPaneWidth, flex: "0 0 auto" }
          : undefined
      }
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatHeader
        sessionId={sessionId}
        usage={usage}
        fastMode={fastMode}
        workspaceOpen={workspaceOpen}
        onToggleWorkspace={() => setWorkspaceOpen((o) => !o)}
        hasMessages={messages.length > 0}
        contextFolder={contextFolder}
        showContextFolder={!remoteMode}
        onPickFolder={handlePickFolder}
        onClearFolder={handleClearFolder}
        onToggleFast={toggleFastMode}
        onNewChat={onNewChat}
        onClear={handleClear}
      />

      {planSuggestion && chatMode !== "plan" && (
        <div className="chat-plan-banner" role="status">
          <span>{t("chat.planSuggest")}</span>
          <button
            type="button"
            className="btn-ghost chat-plan-banner-btn"
            onClick={() => {
              setChatMode("plan");
              setPlanSuggestion(null);
            }}
          >
            {t("chat.planSwitch")}
          </button>
          <button
            type="button"
            className="btn-ghost chat-plan-banner-dismiss"
            onClick={() => setPlanSuggestion(null)}
            aria-label={t("chat.planDismiss")}
          >
            ×
          </button>
        </div>
      )}

      <div className="chat-messages" ref={containerRef}>
        {messages.length === 0 ? (
          <ChatEmptyState onSelectSuggestion={handleSuggestion} />
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            toolProgress={toolProgress}
            toolProgressLog={toolProgressLog}
            chatMode={chatMode}
            streamStall={streamStall}
            onAbort={handleAbort}
            onApprove={actions.handleApprove}
            onDeny={actions.handleDeny}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {planReadyForApproval && (
        <div className="chat-plan-approve-bar" role="status">
          <span>{t("chat.planApproveHint")}</span>
          <button
            type="button"
            className="btn-primary chat-plan-approve-btn"
            onClick={handlePlanApproveAndRun}
            disabled={isLoading}
          >
            {t("chat.planApproveAndRun")}
          </button>
        </div>
      )}

      {queuedCount > 0 && (
        <div className="chat-queue-indicator">
          {t("chat.queued", { count: queuedCount })}
        </div>
      )}
      <div className="chat-input-area">
        <ChatInput
          ref={chatInputRef}
          isLoading={isLoading}
          conversationKey={String(conversationKey)}
          sessionId={hermesSessionId}
          remoteMode={remoteMode}
          onSubmit={handleSubmitOrQueue}
          onAbort={handleAbort}
          onAttachmentPath={bindContextFromAttachmentPath}
        />
        <div className="chat-input-footer">
          <ChatModeSelect
            chatMode={chatMode}
            onChatModeChange={(m) => {
              setChatMode(m);
              if (m === "plan") setPlanSuggestion(null);
            }}
          />
          <ModelPicker
            currentModel={modelConfig.currentModel}
            currentProvider={modelConfig.currentProvider}
            currentBaseUrl={modelConfig.currentBaseUrl}
            modelGroups={modelConfig.modelGroups}
            displayModel={modelConfig.displayModel}
            onOpen={modelConfig.reload}
            onSelectModel={modelConfig.selectModel}
          />
        </div>
      </div>
      {dragActive && (
        <div className="chat-drop-overlay" aria-hidden>
          <div className="chat-drop-overlay-inner">
            {t("chat.dropToAttach")}
          </div>
        </div>
      )}
    </div>
      {showWorkspace && (
        <>
          <ChatSplitResizer
            width={chatPaneWidth}
            onWidthChange={setChatPaneWidth}
          />
          <WorkspacePanel
          root={contextFolder!}
          onAddFileRef={handleAddFileRef}
          onAppendReference={handleAppendReference}
        />
        </>
      )}
    </div>
  );
}

export default Chat;
