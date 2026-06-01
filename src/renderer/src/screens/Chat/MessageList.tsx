import { memo, useMemo, useCallback, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChatMode } from "../../../../shared/chatMode";
import { MessageRow } from "./MessageRow";
import { ReasoningRow, ToolCallRow, ToolResultRow } from "./HistoryRow";
import { DialogueBlock } from "./DialogueBlock";
import { AgentTurnView } from "./AgentTurnView";
import { buildAgentRunSteps } from "./AgentRunPanel";
import { extractCurrentTurnTodos } from "./agentTodos";
import {
  buildAgentTurnPhases,
  splitMessagesIntoTurns,
} from "./agentTurnPhases";
import { orderMessagesForDisplay } from "./messageDisplayOrder";
import { APPROVAL_RE } from "./messageApproval";
import { useI18n } from "../../components/useI18n";
import type { ChatBubbleMessage, ChatMessage } from "./types";
import type { StreamStallState } from "./hooks/useStreamStall";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  toolProgress: string | null;
  toolProgressLog: string[];
  chatMode: ChatMode;
  workspaceRoot?: string | null;
  streamStall?: StreamStallState;
  onAbort?: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onFork?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
}

function isBubble(m: ChatMessage): m is ChatBubbleMessage {
  const k = (m as { kind?: string }).kind;
  return !k || k === "user" || k === "assistant";
}

function turnHasAgentActivity(turn: ChatMessage[]): boolean {
  for (const m of turn) {
    if (m.kind === "reasoning" && (m.text || "").trim()) return true;
    if (m.kind === "tool_call" || m.kind === "tool_result") return true;
    if (isBubble(m) && m.role === "agent" && (m.content || "").trim()) {
      return true;
    }
  }
  return false;
}

// ── Item types for Virtuoso ──────────────────────────

interface TurnItem {
  type: "turn";
  key: string;
  turnIndex: number;
}

interface MessageItem {
  type: "message";
  key: string;
  msg: ChatMessage;
  msgIndex: number;
  isLastMessage: boolean;
}

interface PlaceholderItem {
  type: "placeholder";
  key: string;
}

type VirtuosoItem = TurnItem | MessageItem | PlaceholderItem;

// ── Main component ────────────────────────────────────

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  toolProgress,
  toolProgressLog,
  chatMode,
  workspaceRoot,
  streamStall,
  onAbort,
  onApprove,
  onDeny,
  onFork,
  onBookmark,
}: MessageListProps): React.JSX.Element {
  const { t } = useI18n();
  const virtuosoRef = useRef(null);
  const agentModeUi = chatMode === "agent" || chatMode === "plan";

  const orderedMessages = useMemo(
    () => orderMessagesForDisplay(messages),
    [messages],
  );

  const currentTodos = useMemo(
    () => (agentModeUi ? extractCurrentTurnTodos(orderedMessages) : []),
    [orderedMessages, agentModeUi],
  );

  const turns = useMemo(
    () => splitMessagesIntoTurns(orderedMessages),
    [orderedMessages],
  );

  const lastTurnIndex = turns.length - 1;

  const hasAgentActivity = useMemo(() => {
    const last = turns[lastTurnIndex];
    return last ? turnHasAgentActivity(last.agent) : false;
  }, [turns, lastTurnIndex]);

  const visibleMessages = useMemo(
    () =>
      orderedMessages.filter((m) => {
        if (!isBubble(m)) return true;
        return ((m.content as string) || "").trim().length > 0;
      }),
    [orderedMessages],
  );

  const lastReasoningId = useMemo(() => {
    for (let i = orderedMessages.length - 1; i >= 0; i--) {
      const m = orderedMessages[i];
      if (m.role === "user" || (m as { kind?: string }).kind === "user") break;
      if (m.kind === "reasoning") return m.id;
    }
    return null;
  }, [orderedMessages]);

  // ── Build Virtuoso item list ──────────────────────

  const virtuosoItems = useMemo((): VirtuosoItem[] => {
    if (agentModeUi) {
      const items: VirtuosoItem[] = [];
      for (let i = 0; i < turns.length; i++) {
        items.push({
          type: "turn",
          key: turns[i].user?.id || turns[i].agent[0]?.id || `turn-${i}`,
          turnIndex: i,
        });
      }
      if (isLoading && turns.length === 0) {
        items.push({ type: "placeholder", key: "loading-placeholder" });
      }
      return items;
    }

    // Chat mode: each visible message is an item
    const items: VirtuosoItem[] = visibleMessages.map((msg, i) => ({
      type: "message",
      key: msg.id,
      msg,
      msgIndex: i,
      isLastMessage: i === visibleMessages.length - 1,
    }));

    if (isLoading && !hasAgentActivity) {
      items.push({ type: "placeholder", key: "typing-placeholder" });
    }
    return items;
  }, [agentModeUi, turns, isLoading, visibleMessages, hasAgentActivity]);

  // Virtuoso follow behavior: auto-follow during streaming, respect user scroll otherwise
  const followOutput = useCallback(() => isLoading, [isLoading]);

  // ── Render function for Virtuoso ──────────────────

  const renderItem = useCallback(
    (_index: number, item: VirtuosoItem) => {
      if (item.type === "placeholder") {
        if (agentModeUi) {
          return (
            <div className="chat-transcript-block chat-transcript-block--agent">
              <AgentTurnView
                phases={{ reasoning: "", execution: [], result: "" }}
                isLive
                toolProgress={toolProgress}
                toolProgressLog={toolProgressLog}
                liveSteps={[]}
                todos={currentTodos}
                showThinkingPlaceholder
                isLast
                workspaceRoot={workspaceRoot}
                chatMode={chatMode}
                streamStall={streamStall}
                onAbort={onAbort}
              />
            </div>
          );
        }
        return (
          <div className="chat-transcript-block chat-transcript-block--agent chat-transcript-activity">
            <div className="chat-agent-activity-label">{t("chat.thinking")}</div>
            <div className="chat-typing">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          </div>
        );
      }

      if (item.type === "message") {
        const { msg, isLastMessage } = item as MessageItem;
        const k = (msg as { kind?: string }).kind;
        if (k === "reasoning") {
          return (
            <ReasoningRow
              key={msg.id}
              msg={msg as Extract<ChatMessage, { kind: "reasoning" }>}
              defaultOpen={msg.id === lastReasoningId}
            />
          );
        }
        if (k === "tool_call") {
          return (
            <ToolCallRow
              key={msg.id}
              msg={msg as Extract<ChatMessage, { kind: "tool_call" }>}
              defaultOpen={isLoading}
            />
          );
        }
        if (k === "tool_result") {
          return (
            <ToolResultRow
              key={msg.id}
              msg={msg as Extract<ChatMessage, { kind: "tool_result" }>}
            />
          );
        }
        return (
          <MessageRow
            key={msg.id}
            msg={msg as ChatBubbleMessage}
            isLast={isLastMessage}
            isLoading={isLoading}
            workspaceRoot={workspaceRoot}
            onApprove={onApprove}
            onDeny={onDeny}
            onFork={onFork}
            onBookmark={onBookmark}
          />
        );
      }

      // Turn item (agent mode)
      const { turnIndex, key } = item as TurnItem;
      const turn = turns[turnIndex];
      const isLastTurn = turnIndex === lastTurnIndex;
      const isLive = isLoading && isLastTurn;
      const phases = buildAgentTurnPhases(turn.agent);
      const liveSteps = isLive ? buildAgentRunSteps(turn.agent) : [];
      const hasReasoningRow = turn.agent.some(
        (m) => m.kind === "reasoning" && (m.text || "").trim(),
      );
      const needsApproval =
        !isLoading &&
        isLastTurn &&
        !!phases.result &&
        APPROVAL_RE.test(phases.result);

      return (
        <div key={key} className="chat-paradigm-turn" data-turn-index={turnIndex}>
          {turn.user && isBubble(turn.user) && turn.user.role === "user" && (
            <DialogueBlock msg={turn.user} onFork={onFork} />
          )}
          {(turn.agent.length > 0 || isLive) && (
            <div className="chat-transcript-block chat-transcript-block--agent">
              <AgentTurnView
                phases={phases}
                isLive={isLive}
                toolProgress={isLive ? toolProgress : null}
                toolProgressLog={isLive ? toolProgressLog : []}
                liveSteps={liveSteps}
                todos={isLive ? currentTodos : []}
                showThinkingPlaceholder={isLive && !hasReasoningRow}
                isLast={isLastTurn}
                workspaceRoot={workspaceRoot}
                chatMode={chatMode}
                needsApproval={needsApproval}
                streamStall={isLive ? streamStall : undefined}
                onAbort={onAbort}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            </div>
          )}
        </div>
      );
    },
    [
      agentModeUi,
      toolProgress,
      toolProgressLog,
      currentTodos,
      workspaceRoot,
      streamStall,
      onAbort,
      onApprove,
      onDeny,
      onFork,
      isLoading,
      turns,
      lastTurnIndex,
      lastReasoningId,
      t,
    ],
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={virtuosoItems}
      itemContent={renderItem}
      followOutput={followOutput}
      // Estimate item sizes for smoother scrolling
      computeItemKey={(_, item) => (item as VirtuosoItem).key}
      style={{ flex: 1 }}
    />
  );
});
