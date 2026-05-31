import { useCallback, useState } from "react";
import { FileCode, Copy, Check } from "lucide-react";

interface FileRefChipProps {
  /** Full relative or absolute path shown in the tooltip. */
  fullPath: string;
  /** Display name (basename + optional line range). */
  displayName: string;
  /** Optional line range (e.g. "123-456"). */
  lineRange?: string;
  /** Workspace root for opening the file. */
  workspaceRoot?: string | null;
  /** Callback when the user clicks the chip. */
  onOpen?: (path: string) => void;
}

export function FileRefChip({
  fullPath,
  displayName,
  lineRange,
  workspaceRoot,
  onOpen,
}: FileRefChipProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    if (onOpen) {
      onOpen(fullPath);
    } else if (workspaceRoot) {
      // Open file in workspace via parent handler
      // Try to open in OS's default editor as fallback
      await window.hermesAPI.openExternal("file://" + fullPath);
    } else {
      // Copy path to clipboard
      await navigator.clipboard.writeText(fullPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fullPath, workspaceRoot, onOpen]);

  return (
    <button
      type="button"
      className="file-ref-chip"
      onClick={handleClick}
      title={fullPath + (lineRange ? ` (lines ${lineRange})` : "")}
    >
      <FileCode size={12} className="file-ref-chip-icon" />
      <span className="file-ref-chip-name">{displayName}</span>
      {lineRange && <span className="file-ref-chip-lines">:{lineRange}</span>}
      {copied ? (
        <Check size={11} className="file-ref-chip-copied" />
      ) : (
        <Copy size={11} className="file-ref-chip-copy" />
      )}
    </button>
  );
}
