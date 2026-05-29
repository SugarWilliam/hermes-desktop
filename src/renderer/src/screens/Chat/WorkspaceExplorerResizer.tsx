import { memo, useEffect, useRef } from "react";
import type { ExplorerSide } from "./workspaceExplorerSide";
import {
  EXPLORER_MIN,
  EXPLORER_MAX,
  clampExplorerWidth,
  saveExplorerWidth,
} from "./workspaceExplorerWidth";

interface WorkspaceExplorerResizerProps {
  width: number;
  side: ExplorerSide;
  onWidthChange: (width: number) => void;
}

/** Drag handle between editor (center) and file explorer (edge). */
export const WorkspaceExplorerResizer = memo(function WorkspaceExplorerResizer({
  width,
  side,
  onWidthChange,
}: WorkspaceExplorerResizerProps): React.JSX.Element {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    function onMove(e: MouseEvent): void {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next =
        side === "right"
          ? clampExplorerWidth(startW.current - delta)
          : clampExplorerWidth(startW.current + delta);
      onWidthChange(next);
    }
    function onUp(): void {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("chat-split-resizing");
      saveExplorerWidth(widthRef.current);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange, side]);

  return (
    <div
      className="chat-split-resizer chat-workspace-explorer-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={EXPLORER_MIN}
      aria-valuemax={EXPLORER_MAX}
      tabIndex={0}
      title="Drag to resize"
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startW.current = width;
        document.body.classList.add("chat-split-resizing");
      }}
      onKeyDown={(e) => {
        const step = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
        if (!step) return;
        const delta = side === "right" ? -step : step;
        const next = clampExplorerWidth(width + delta);
        onWidthChange(next);
        saveExplorerWidth(next);
      }}
    />
  );
});
