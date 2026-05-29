export const EXPLORER_WIDTH_KEY = "hermes.workspaceExplorerWidth";
export const EXPLORER_DEFAULT = 240;
export const EXPLORER_MIN = 180;
export const EXPLORER_MAX = 420;

export function readExplorerWidth(): number {
  try {
    const n = Number.parseInt(
      sessionStorage.getItem(EXPLORER_WIDTH_KEY) || "",
      10,
    );
    if (Number.isFinite(n) && n >= EXPLORER_MIN && n <= EXPLORER_MAX) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return EXPLORER_DEFAULT;
}

export function clampExplorerWidth(w: number): number {
  return Math.max(EXPLORER_MIN, Math.min(EXPLORER_MAX, Math.round(w)));
}

export function saveExplorerWidth(w: number): void {
  try {
    sessionStorage.setItem(EXPLORER_WIDTH_KEY, String(w));
  } catch {
    /* ignore */
  }
}
