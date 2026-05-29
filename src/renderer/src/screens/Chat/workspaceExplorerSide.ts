export type ExplorerSide = "left" | "right";

export const EXPLORER_SIDE_KEY = "hermes.workspaceExplorerSide";

export function readExplorerSide(): ExplorerSide {
  try {
    const v = sessionStorage.getItem(EXPLORER_SIDE_KEY);
    if (v === "left" || v === "right") return v;
  } catch {
    /* ignore */
  }
  return "right";
}

export function saveExplorerSide(side: ExplorerSide): void {
  try {
    sessionStorage.setItem(EXPLORER_SIDE_KEY, side);
  } catch {
    /* ignore */
  }
}

export function toggleExplorerSide(side: ExplorerSide): ExplorerSide {
  const next: ExplorerSide = side === "right" ? "left" : "right";
  saveExplorerSide(next);
  return next;
}
