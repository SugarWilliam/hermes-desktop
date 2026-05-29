export type ThinkingSegment =
  | { type: "meta"; text: string }
  | { type: "prose"; text: string }
  | {
      type: "code";
      language: string;
      code: string;
      file?: string;
      added?: number;
      removed?: number;
    };

const FENCE_RE = /```([\w+#.-]*)\n([\s\S]*?)```/g;

function parseStatsLine(line: string): {
  added?: number;
  removed?: number;
} | null {
  const m = line.trim().match(/^\+(\d+)(?:\s+-(\d+))?$/);
  if (!m) return null;
  return {
    added: Number(m[1]),
    removed: m[2] != null ? Number(m[2]) : undefined,
  };
}

function metaFromPreamble(text: string): {
  file?: string;
  added?: number;
  removed?: number;
  metaLines: string[];
} {
  const lines = text.split("\n").map((l) => l.trim());
  let file: string | undefined;
  let added: number | undefined;
  let removed: number | undefined;
  const metaLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("#")) {
      file = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    const stats = parseStatsLine(line);
    if (stats) {
      added = stats.added;
      removed = stats.removed;
      continue;
    }
    if (/^explored\b/i.test(line) || /^searched\b/i.test(line)) {
      metaLines.push(line);
      continue;
    }
  }

  return { file, added, removed, metaLines };
}

function parseProseBlock(text: string): ThinkingSegment[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const { metaLines } = metaFromPreamble(trimmed);
  const segments: ThinkingSegment[] = [];
  if (metaLines.length > 0) {
    segments.push({ type: "meta", text: metaLines.join("\n") });
  }
  const prose = trimmed
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;
      if (parseStatsLine(t)) return false;
      if (/^explored\b/i.test(t) || /^searched\b/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
  if (prose) segments.push({ type: "prose", text: prose });
  if (!prose && !metaLines.length && trimmed) {
    segments.push({ type: "prose", text: trimmed });
  }
  return segments;
}

/** Split agent reasoning into Cursor-style blocks (meta, prose, fenced code). */
export function parseThinkingContent(raw: string): ThinkingSegment[] {
  const text = raw.trim();
  if (!text) return [];

  const segments: ThinkingSegment[] = [];
  let last = 0;
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FENCE_RE.exec(text)) !== null) {
    const before = text.slice(last, match.index);
    if (before.trim()) {
      segments.push(...parseProseBlock(before));
    }
    const preamble = before.trim();
    const { file, added, removed } = metaFromPreamble(preamble);
    segments.push({
      type: "code",
      language: match[1] || "text",
      code: match[2].replace(/\n$/, ""),
      file,
      added,
      removed,
    });
    last = match.index + match[0].length;
  }

  const tail = text.slice(last);
  if (tail.trim()) {
    segments.push(...parseProseBlock(tail));
  }

  if (segments.length === 0) {
    segments.push({ type: "prose", text });
  }

  return segments;
}
