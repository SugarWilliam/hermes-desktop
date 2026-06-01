export type CalloutKind =
  | "note"
  | "tip"
  | "important"
  | "warning"
  | "caution"
  | "info";

export interface ParsedCallout {
  kind: CalloutKind;
  title: string;
  /** Regex used to strip the alert prefix from the first paragraph */
  prefixPattern: RegExp;
}

const GFM_ALERT =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

const CN_ALERT =
  /^(?:【?\s*)?(注意|提示|警告|重要|说明)(?:\s*】)?[:：]\s*/;

const TITLES: Record<CalloutKind, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
  info: "Info",
};

const CN_KIND: Record<string, CalloutKind> = {
  注意: "warning",
  警告: "warning",
  提示: "tip",
  重要: "important",
  说明: "note",
};

export function parseCallout(text: string): ParsedCallout | null {
  const t = text.trimStart();
  const gfm = GFM_ALERT.exec(t);
  if (gfm) {
    const raw = gfm[1].toLowerCase() as CalloutKind;
    const kind: CalloutKind =
      raw === "important" ? "important" : (raw as CalloutKind);
    return {
      kind,
      title: TITLES[kind] ?? gfm[1],
      prefixPattern: GFM_ALERT,
    };
  }
  const cn = CN_ALERT.exec(t);
  if (cn) {
    const kind = CN_KIND[cn[1]] ?? "info";
    return {
      kind,
      title: cn[1],
      prefixPattern: CN_ALERT,
    };
  }
  return null;
}

export function stripCalloutPrefix(text: string, pattern: RegExp): string {
  return text.replace(pattern, "").trimStart();
}
