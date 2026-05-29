import { useEffect } from "react";
import type { ChatMode } from "../../../../../shared/chatMode";
import type { ChatMessage } from "../types";
import type { StreamGuard } from "../streamGuard";
import {
  dbItemsToChatMessages,
  reconcileStreamedWithDb,
  type DbHistoryItem,
} from "../sessionHistory";

const POLL_MS = 300;

interface UseLiveSessionSyncArgs {
  isLoading: boolean;
  sessionId: string | null;
  chatMode: ChatMode;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  streamGuard: StreamGuard;
}

/**
 * While Agent/Plan is running, periodically merge reasoning / tool rows from
 * state.db into the live transcript. The gateway often writes these only to
 * the DB (NousResearch/hermes-agent#30449), so without polling the UI shows
 * only typing dots until stream end.
 */
export function useLiveSessionSync({
  isLoading,
  sessionId,
  chatMode,
  setMessages,
  streamGuard,
}: UseLiveSessionSyncArgs): void {
  useEffect(() => {
    if (!isLoading || !sessionId) return;
    if (chatMode !== "agent" && chatMode !== "plan") return;
    if (!streamGuard.isActive()) return;

    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled || !streamGuard.isActive()) return;
      if (!streamGuard.acceptsSession(sessionId)) return;
      try {
        const items = (await window.hermesAPI.getSessionMessages(
          sessionId,
        )) as DbHistoryItem[];
        if (cancelled || items.length === 0) return;
        if (!streamGuard.acceptsSession(sessionId)) return;
        const dbMessages = dbItemsToChatMessages(items);
        setMessages((prev) => reconcileStreamedWithDb(prev, dbMessages));
      } catch {
        /* best-effort UX */
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isLoading, sessionId, chatMode, setMessages, streamGuard]);
}
