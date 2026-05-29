import { memo, useEffect, useRef } from "react";
import {
  CHAT_PANE_MIN,
  CHAT_PANE_MAX,
  clampChatPaneWidth,
  saveChatPaneWidth,
} from "./chatPaneWidth";

interface ChatSplitResizerProps {
  width: number;
  onWidthChange: (width: number) => void;
}

/** Vertical drag handle between chat (left) and workspace (right). */
export const ChatSplitResizer = memo(function ChatSplitResizer({
  width,
  onWidthChange,
}: ChatSplitResizerProps): React.JSX.Element {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    function onMove(e: MouseEvent): void {
      if (!dragging.current) return;
      const next = clampChatPaneWidth(
        startW.current + (e.clientX - startX.current),
      );
      onWidthChange(next);
    }
    function onUp(): void {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("chat-split-resizing");
      saveChatPaneWidth(widthRef.current);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange]);

  return (
    <div
      className="chat-split-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={CHAT_PANE_MIN}
      aria-valuemax={CHAT_PANE_MAX}
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
        if (e.key === "ArrowLeft") {
          const next = clampChatPaneWidth(width - 16);
          onWidthChange(next);
          saveChatPaneWidth(next);
        }
        if (e.key === "ArrowRight") {
          const next = clampChatPaneWidth(width + 16);
          onWidthChange(next);
          saveChatPaneWidth(next);
        }
      }}
    />
  );
});
