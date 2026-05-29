import { memo, useMemo } from "react";
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
  streamStall?: StreamStallState;
  onAbort?: () => void;
  onApprove: () => void;
  onDeny: () => void;
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

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  toolProgress,
  toolProgressLog,
  chatMode,
  streamStall,
  onAbort,
  onApprove,
  onDeny,
}: MessageListProps): React.JSX.Element {
  const { t } = useI18n();
  const orderedMessages = useMemo(
    () => orderMessagesForDisplay(messages),
    [messages],
  );

  const agentModeUi = chatMode === "agent" || chatMode === "plan";
  const currentTodos = useMemo(
    () => (agentModeUi ? extractCurrentTurnTodos(orderedMessages) : []),
    [orderedMessages, agentModeUi],
  );

  const turns = useMemo(
    () => splitMessagesIntoTurns(orderedMessages),
    [orderedMessages],
  );

  const hasAgentActivity = useMemo(() => {
    const last = turns[turns.length - 1];
    return last ? turnHasAgentActivity(last.agent) : false;
  }, [turns]);

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

  if (agentModeUi) {
    const lastTurnIndex = turns.length - 1;
    return (
      <>
        {turns.map((turn, turnIndex) => {
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

          const turnKey =
            turn.user?.id ||
            turn.agent[0]?.id ||
            `turn-${turnIndex}`;

          return (
            <div key={turnKey} className="chat-paradigm-turn">
              {turn.user && isBubble(turn.user) && turn.user.role === "user" && (
                <DialogueBlock msg={turn.user} />
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
        })}
        {isLoading && turns.length === 0 && (
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
              streamStall={streamStall}
              onAbort={onAbort}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {visibleMessages.map((msg, i) => {
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
        const bubble = msg as ChatBubbleMessage;
        return (
          <MessageRow
            key={msg.id}
            msg={bubble}
            isLast={i === visibleMessages.length - 1}
            isLoading={isLoading}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        );
      })}

      {isLoading && !hasAgentActivity && (
        <div className="chat-transcript-block chat-transcript-block--agent chat-transcript-activity">
          <div className="chat-agent-activity-label">{t("chat.thinking")}</div>
          <div className="chat-typing">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        </div>
      )}
    </>
  );
});
