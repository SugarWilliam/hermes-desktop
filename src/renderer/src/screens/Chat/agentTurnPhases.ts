import type {
  ChatBubbleMessage,
  ChatMessage,
  ToolCallMessage,
  ToolResultMessage,
} from "./types";

export type ExecutionItem =
  | {
      type: "viewed";
      id: string;
      path: string;
      name: string;
    }
  | {
      type: "terminal";
      id: string;
      command: string;
      running: boolean;
      label?: string;
    }
  | {
      type: "skill";
      id: string;
      name: string;
      done: boolean;
    }
  | {
      type: "tool";
      id: string;
      name: string;
      detail?: string;
      done: boolean;
    }
  | {
      type: "progress";
      id: string;
      text: string;
    }
  | {
      type: "todo_update";
      id: string;
      done: boolean;
    }
  | {
      type: "exploring";
      id: string;
      label: string;
    };

export interface AgentTurnPhases {
  reasoning: string;
  execution: ExecutionItem[];
  result: string;
}

function isUserMessage(m: ChatMessage): boolean {
  if ("kind" in m && m.kind === "user") return true;
  return !("kind" in m) && m.role === "user";
}

function isAgentBubble(m: ChatMessage): m is ChatBubbleMessage {
  return !("kind" in m) && m.role === "agent";
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    const v = JSON.parse(t) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pathFromToolArgs(args: string): string | null {
  const j = tryParseJson(args);
  if (j) {
    for (const key of ["path", "file_path", "file", "filepath", "target"]) {
      const v = j[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  const m = args.match(/["']([^"']+\.[a-zA-Z0-9]{1,8})["']/);
  return m ? m[1] : null;
}

function commandFromTool(args: string): string | null {
  const j = tryParseJson(args);
  if (j) {
    const cmd = j.command ?? j.cmd ?? j.script;
    if (typeof cmd === "string" && cmd.trim()) return cmd.trim();
  }
  const flat = args.replace(/\s+/g, " ").trim();
  if (flat.length > 0 && flat.length < 200) return flat;
  return null;
}

function classifyToolCall(
  tc: ToolCallMessage,
  done: boolean,
): ExecutionItem | ExecutionItem[] {
  const n = tc.name.toLowerCase();
  const path = pathFromToolArgs(tc.args);

  if (
    path &&
    (n.includes("read") ||
      n.includes("view") ||
      n.includes("glob") ||
      n.includes("grep") ||
      n.includes("list") ||
      n.includes("search"))
  ) {
    return {
      type: "viewed",
      id: tc.id,
      path,
      name: basename(path),
    };
  }

  if (
    n.includes("terminal") ||
    n.includes("shell") ||
    n.includes("bash") ||
    n.includes("powershell") ||
    n.includes("run_command") ||
    n === "exec"
  ) {
    const command = commandFromTool(tc.args) || tc.name;
    return {
      type: "terminal",
      id: tc.id,
      command,
      running: !done,
      label: n,
    };
  }

  if (n.includes("skill")) {
    const j = tryParseJson(tc.args);
    const skillName =
      (typeof j?.name === "string" && j.name) ||
      (typeof j?.skill === "string" && j.skill) ||
      tc.name;
    return {
      type: "skill",
      id: tc.id,
      name: String(skillName),
      done,
    };
  }

  if (n.includes("todo") || n.includes("task")) {
    return {
      type: "todo_update",
      id: tc.id,
      done,
    };
  }

  const detail = commandFromTool(tc.args) || undefined;
  return {
    type: "tool",
    id: tc.id,
    name: tc.name,
    detail,
    done,
  };
}

/** Cursor-style phases for one assistant turn. */
export function buildAgentTurnPhases(turn: ReadonlyArray<ChatMessage>): AgentTurnPhases {
  const reasoningParts: string[] = [];
  const execution: ExecutionItem[] = [];
  const resultParts: string[] = [];

  const resultsByCall = new Map<string, ToolResultMessage>();
  for (const m of turn) {
    if (m.kind === "tool_result") {
      resultsByCall.set(m.callId || m.id, m);
    }
  }

  for (const m of turn) {
    if (m.kind === "reasoning" && m.text.trim()) {
      reasoningParts.push(m.text.trim());
    } else if (m.kind === "tool_call") {
      const tr = resultsByCall.get(m.callId || m.id);
      const done = !!tr;
      const item = classifyToolCall(m, done);
      if (Array.isArray(item)) execution.push(...item);
      else execution.push(item);
    } else if (isAgentBubble(m) && m.content.trim()) {
      resultParts.push(m.content.trim());
    }
  }

  return {
    reasoning: reasoningParts.join("\n\n"),
    execution,
    result: resultParts.join("\n\n"),
  };
}

export function splitMessagesIntoTurns(
  messages: ReadonlyArray<ChatMessage>,
): Array<{ user: ChatMessage | null; agent: ChatMessage[] }> {
  const turns: Array<{ user: ChatMessage | null; agent: ChatMessage[] }> = [];
  let i = 0;
  while (i < messages.length) {
    if (isUserMessage(messages[i])) {
      const user = messages[i];
      i++;
      const agent: ChatMessage[] = [];
      while (i < messages.length && !isUserMessage(messages[i])) {
        agent.push(messages[i]);
        i++;
      }
      turns.push({ user, agent });
    } else {
      const agent: ChatMessage[] = [];
      while (i < messages.length && !isUserMessage(messages[i])) {
        agent.push(messages[i]);
        i++;
      }
      turns.push({ user: null, agent });
    }
  }
  return turns;
}

export function isUserMsg(m: ChatMessage): boolean {
  return isUserMessage(m);
}
