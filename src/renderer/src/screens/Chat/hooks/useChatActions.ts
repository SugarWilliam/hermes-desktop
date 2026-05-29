import { useCallback, useEffect, useRef } from "react";
import type { ChatInputHandle } from "../ChatInput";
import type { ChatMode } from "../../../../../shared/chatMode";
import type { StreamGuard } from "../streamGuard";
import type { Attachment, ChatMessage } from "../types";
import {
  buildAgentHistoryPayload,
  dbItemsToChatMessages,
  reconcileStreamedWithDb,
  type DbHistoryItem,
} from "../sessionHistory";

interface LocalCommands {
  isLocal: (text: string) => boolean;
  executeLocal: (text: string) => Promise<boolean>;
}

interface UseChatActionsArgs {
  profile?: string;
  hermesSessionId: string | null;
  setHermesSessionId: (id: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onSessionStarted?: () => void;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
  localCommands: LocalCommands;
  /** Working folder bound to this conversation (issue #27), or null. */
  contextFolder: string | null;
  chatMode: ChatMode;
  streamGuard: StreamGuard;
  /** Sync session id ref immediately on send — avoids parent sync aborting the stream. */
  bindSessionId?: (sessionId: string) => void;
}

interface UseChatActionsResult {
  handleSend: (
    text: string,
    attachments?: Attachment[],
    skipLoadingCheck?: boolean,
    modeOverride?: ChatMode,
  ) => Promise<void>;
  handleQuickAsk: (text: string, attachments?: Attachment[]) => Promise<void>;
  handleAbort: () => void;
  handleApprove: () => void;
  handleDeny: () => void;
}

/**
 * Encapsulates the chat's user-facing actions (send, quick-ask, abort,
 * approve, deny). All returned callbacks have stable identities so that
 * memoized children don't re-render on every streaming chunk — `messages`
 * and `isLoading` are read via live refs that update via `useEffect`.
 */
export function useChatActions({
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
}: UseChatActionsArgs): UseChatActionsResult {
  const messagesRef = useRef(messages);
  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    messagesRef.current = messages;
    isLoadingRef.current = isLoading;
  });

  const pushUser = useCallback(
    (content: string, idPrefix = "user", attachments?: Attachment[]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${idPrefix}-${Date.now()}`,
          role: "user",
          content,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        },
      ]);
    },
    [setMessages],
  );

  const sendToAgent = useCallback(
    async (
      text: string,
      attachments?: Attachment[],
      mode?: ChatMode,
    ): Promise<void> => {
      const sessionId =
        hermesSessionId || `desk-${Date.now()}-${crypto.randomUUID()}`;
      if (!hermesSessionId) {
        bindSessionId?.(sessionId);
        setHermesSessionId(sessionId);
      }

      let historySource: ReadonlyArray<ChatMessage> = messagesRef.current;
      if (hermesSessionId) {
        try {
          const items = (await window.hermesAPI.getSessionMessages(
            sessionId,
          )) as DbHistoryItem[];
          const dbMessages = dbItemsToChatMessages(items);
          if (dbMessages.length > 0) {
            historySource = reconcileStreamedWithDb(
              messagesRef.current,
              dbMessages,
            );
          }
        } catch {
          /* fall back to in-memory transcript */
        }
      }

      try {
        await window.hermesAPI.sendMessage(
          text,
          profile,
          sessionId,
          buildAgentHistoryPayload(historySource),
          attachments,
          contextFolder ?? undefined,
          mode ?? chatMode,
        );
      } catch {
        // onChatError IPC already surfaces this to the user
      }
    },
    [
      profile,
      hermesSessionId,
      setHermesSessionId,
      contextFolder,
      chatMode,
      bindSessionId,
    ],
  );

  const handleSend = useCallback(
    async (
      text: string,
      attachments?: Attachment[],
      skipLoadingCheck = false,
      modeOverride?: ChatMode,
    ): Promise<void> => {
      const hasPayload = text.length > 0 || (attachments?.length ?? 0) > 0;
      if (!hasPayload) return;
      if (!skipLoadingCheck && isLoadingRef.current) return;

      if (text && localCommands.isLocal(text)) {
        const cmd = text.split(/\s+/)[0].toLowerCase();
        if (cmd !== "/new" && cmd !== "/clear") pushUser(text);
        await localCommands.executeLocal(text);
        return;
      }

      streamGuard.claim();
      setIsLoading(true);
      pushUser(text, "user", attachments);
      onSessionStarted?.();
      await sendToAgent(text, attachments, modeOverride);
    },
    [localCommands, pushUser, onSessionStarted, sendToAgent, setIsLoading, streamGuard],
  );

  const handleQuickAsk = useCallback(
    async (text: string, attachments?: Attachment[]): Promise<void> => {
      if (!text || isLoadingRef.current) return;
      streamGuard.claim();
      setIsLoading(true);
      pushUser(`💭 ${text}`, "user-btw", attachments);
      await sendToAgent(`/btw ${text}`, attachments);
    },
    [pushUser, sendToAgent, setIsLoading, streamGuard],
  );

  const handleAbort = useCallback(() => {
    streamGuard.invalidate();
    window.hermesAPI.abortChat();
    setIsLoading(false);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  }, [chatInputRef, setIsLoading, streamGuard]);

  const handleApprove = useCallback(() => {
    chatInputRef.current?.clear();
    streamGuard.claim();
    setIsLoading(true);
    pushUser("/approve", "user-approve");
    sendToAgent("/approve").catch(() => setIsLoading(false));
  }, [chatInputRef, pushUser, sendToAgent, setIsLoading, streamGuard]);

  const handleDeny = useCallback(() => {
    chatInputRef.current?.clear();
    streamGuard.claim();
    setIsLoading(true);
    pushUser("/deny", "user-deny");
    sendToAgent("/deny").catch(() => setIsLoading(false));
  }, [chatInputRef, pushUser, sendToAgent, setIsLoading, streamGuard]);

  return { handleSend, handleQuickAsk, handleAbort, handleApprove, handleDeny };
}
