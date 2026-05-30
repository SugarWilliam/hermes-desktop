import { useEffect } from "react";
import { enrichChatErrorMessage } from "../../../../../shared/chatErrorHints";
import { useI18n } from "../../../components/useI18n";
import type { ChatMessage, UsageState } from "../types";
import type { StreamGuard } from "../streamGuard";
import {
  dbItemsToChatMessages,
  reconcileStreamedWithDb,
  type DbHistoryItem,
} from "../sessionHistory";

function parseChatErrorPayload(
  payload: string | { error: string; sessionId?: string },
): { error: string; sessionId?: string } {
  if (typeof payload === "string") return { error: payload };
  return {
    error: payload.error,
    sessionId: payload.sessionId,
  };
}

interface UseChatIPCArgs {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setHermesSessionId: (id: string) => void;
  setToolProgress: (tool: string | null) => void;
  setToolProgressLog: React.Dispatch<React.SetStateAction<string[]>>;
  setIsLoading: (loading: boolean) => void;
  setUsage: React.Dispatch<React.SetStateAction<UsageState | null>>;
  streamGuard: StreamGuard;
  bindSessionId?: (sessionId: string) => void;
}

/**
 * Registers all chat-related IPC listeners once and tears them down on unmount.
 *
 * Each listener writes through the provided setters; consumers should pass
 * stable `useState`/`useDispatch` setters (React guarantees identity).
 *
 * `streamGuard` drops events from aborted or superseded streams when the user
 * switches sessions without waiting for the prior stream to finish.
 */
export function useChatIPC({
  setMessages,
  setHermesSessionId,
  setToolProgress,
  setToolProgressLog,
  setIsLoading,
  setUsage,
  streamGuard,
  bindSessionId,
}: UseChatIPCArgs): void {
  const { t } = useI18n();
  useEffect(() => {
    const cleanupChunk = window.hermesAPI.onChatChunk((chunk) => {
      if (!streamGuard.isActive()) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === "agent" &&
          "content" in last &&
          typeof last.content === "string"
        ) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        }
        if (!chunk || !chunk.trim()) return prev;
        return [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", content: chunk },
        ];
      });
    });

    const cleanupSessionId = window.hermesAPI.onChatSessionId((sid) => {
      if (!sid || !streamGuard.isActive()) return;
      bindSessionId?.(sid);
      setHermesSessionId(sid);
    });

    const cleanupReasoning = window.hermesAPI.onChatReasoningChunk((chunk) => {
      if (!chunk || !streamGuard.isActive()) return;
      setMessages((prev) => {
        let insertAt = prev.length;
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (m.role === "user") break;
          if ("kind" in m && m.kind === "reasoning") {
            return [
              ...prev.slice(0, i),
              { ...m, text: m.text + chunk },
              ...prev.slice(i + 1),
            ];
          }
          insertAt = i;
        }
        return [
          ...prev.slice(0, insertAt),
          {
            id: `reasoning-${Date.now()}`,
            kind: "reasoning",
            role: "agent",
            text: chunk,
          },
          ...prev.slice(insertAt),
        ];
      });
    });

    const cleanupDone = window.hermesAPI.onChatDone(async (sessionId) => {
      if (!streamGuard.acceptsSession(sessionId || undefined)) return;
      if (sessionId) {
        bindSessionId?.(sessionId);
        setHermesSessionId(sessionId);
      }
      setToolProgress(null);
      setToolProgressLog([]);
      setIsLoading(false);
      try {
        await window.hermesAPI.syncSessionCache();
      } catch {
        /* list refresh is best-effort */
      }
      if (!sessionId) return;
      try {
        const items = (await window.hermesAPI.getSessionMessages(
          sessionId,
        )) as DbHistoryItem[];
        const dbMessages = dbItemsToChatMessages(items);
        if (dbMessages.length === 0) return;
        if (!streamGuard.acceptsSession(sessionId)) return;
        setMessages((prev) => reconcileStreamedWithDb(prev, dbMessages));
      } catch {
        /* merge is best-effort */
      }
    });

    const cleanupError = window.hermesAPI.onChatError((payload) => {
      if (!streamGuard.isActive()) return;
      const { error, sessionId: errSessionId } = parseChatErrorPayload(payload);
      if (errSessionId) {
        bindSessionId?.(errSessionId);
        setHermesSessionId(errSessionId);
      }
      const display = enrichChatErrorMessage(error, {
        codexTtfb: t("chat.phase.codexTtfbHint"),
        contextLength: t("chat.phase.contextLengthHint"),
        agentIdle: t("chat.phase.agentIdleHint"),
        sessionNotFound: t("chat.phase.sessionNotFoundHint"),
        apiServerKey: t("chat.phase.apiServerKeyHint"),
        gatewayApiUnavailable: t("chat.phase.gatewayApiUnavailableHint"),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "agent",
          content: `Error: ${display}`,
        },
      ]);
      setToolProgress(null);
      setToolProgressLog([]);
      setIsLoading(false);
      void window.hermesAPI.syncSessionCache().catch(() => {
        /* best-effort */
      });
      if (!errSessionId) return;
      void (async (): Promise<void> => {
        try {
          const items = (await window.hermesAPI.getSessionMessages(
            errSessionId,
          )) as DbHistoryItem[];
          const dbMessages = dbItemsToChatMessages(items);
          if (dbMessages.length === 0) return;
          if (!streamGuard.acceptsSession(errSessionId)) return;
          setMessages((prev) => reconcileStreamedWithDb(prev, dbMessages));
        } catch {
          /* merge is best-effort */
        }
      })();
    });

    const cleanupToolProgress = window.hermesAPI.onChatToolProgress((tool) => {
      if (!streamGuard.isActive()) return;
      setToolProgress(tool);
      if (!tool) return;
      setToolProgressLog((prev) => {
        if (prev[prev.length - 1] === tool) return prev;
        return [...prev, tool].slice(-24);
      });
    });

    const cleanupUsage = window.hermesAPI.onChatUsage((u) => {
      if (!streamGuard.isActive()) return;
      setUsage((prev) => ({
        promptTokens: (prev?.promptTokens || 0) + u.promptTokens,
        completionTokens: (prev?.completionTokens || 0) + u.completionTokens,
        totalTokens: (prev?.totalTokens || 0) + u.totalTokens,
        cost: u.cost != null ? (prev?.cost || 0) + u.cost : prev?.cost,
      }));
    });

    return () => {
      cleanupChunk();
      cleanupSessionId();
      cleanupReasoning();
      cleanupDone();
      cleanupError();
      cleanupToolProgress();
      cleanupUsage();
    };
  }, [
    setMessages,
    setHermesSessionId,
    setToolProgress,
    setToolProgressLog,
    setIsLoading,
    setUsage,
    streamGuard,
    bindSessionId,
    t,
  ]);
}
