export const CHAT_PANE_WIDTH_KEY = "hermes.chatPaneWidth";
export const CHAT_PANE_DEFAULT = 420;
export const CHAT_PANE_MIN = 280;
export const CHAT_PANE_MAX = 720;

export function readChatPaneWidth(): number {
  try {
    const n = Number.parseInt(
      sessionStorage.getItem(CHAT_PANE_WIDTH_KEY) || "",
      10,
    );
    if (Number.isFinite(n) && n >= CHAT_PANE_MIN && n <= CHAT_PANE_MAX) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return CHAT_PANE_DEFAULT;
}

export function clampChatPaneWidth(w: number): number {
  const max = Math.min(
    CHAT_PANE_MAX,
    Math.floor(typeof window !== "undefined" ? window.innerWidth * 0.65 : CHAT_PANE_MAX),
  );
  return Math.max(CHAT_PANE_MIN, Math.min(max, Math.round(w)));
}

export function saveChatPaneWidth(w: number): void {
  try {
    sessionStorage.setItem(CHAT_PANE_WIDTH_KEY, String(w));
  } catch {
    /* ignore */
  }
}
