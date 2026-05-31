import { useState, useCallback } from "react";
import { Check, X, FileWarning } from "lucide-react";

interface DiffApplyViewProps {
  code: string;
  workspaceRoot?: string;
}

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "applied"; files: string[]; backupDir: string | null }
  | { kind: "error"; message: string };

export function DiffApplyView({
  code,
  workspaceRoot,
}: DiffApplyViewProps): React.JSX.Element {
  const [state, setState] = useState<ApplyState>({ kind: "idle" });

  const handleApply = useCallback(async () => {
    if (!workspaceRoot) return;
    setState({ kind: "applying" });
    try {
      const result = await window.hermesAPI.applyDiff(workspaceRoot, code);
      if (result.errors.length > 0 && result.files.length === 0) {
        setState({ kind: "error", message: result.errors.join("; ") });
      } else {
        setState({
          kind: "applied",
          files: result.files,
          backupDir: result.backupDir,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message: msg });
    }
  }, [code, workspaceRoot]);

  const handleReject = useCallback(() => {
    // No persistent state change needed — just let the user know
    setState({ kind: "idle" });
  }, []);

  // Diff content rendering (same as original DiffView)
  const lines = code.split("\n");

  return (
    <div className="chat-diff-apply-view">
      {/* Action bar */}
      <div className="chat-diff-apply-bar">
        <span className="chat-diff-apply-label">Proposed changes</span>
        <div className="chat-diff-apply-actions">
          {state.kind === "applied" ? (
            <>
              <span className="chat-diff-apply-success">
                <Check size={14} />
                Applied to {state.files.length} file
                {state.files.length !== 1 ? "s" : ""}
              </span>
              {state.backupDir && (
                <span className="chat-diff-apply-backup" title={state.backupDir}>
                  Backups saved
                </span>
              )}
            </>
          ) : state.kind === "error" ? (
            <span className="chat-diff-apply-error">
              <FileWarning size={14} />
              {state.message}
            </span>
          ) : (
            <>
              <button
                type="button"
                className="chat-diff-apply-btn chat-diff-apply-reject"
                onClick={handleReject}
                disabled={state.kind === "applying"}
              >
                <X size={13} />
                Reject
              </button>
              <button
                type="button"
                className="chat-diff-apply-btn chat-diff-apply-accept"
                onClick={handleApply}
                disabled={state.kind === "applying" || !workspaceRoot}
              >
                {state.kind === "applying" ? (
                  <>Applying…</>
                ) : (
                  <>
                    <Check size={13} />
                    Apply
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="chat-diff-content">
        {lines.map((line, i) => {
          let cls = "chat-diff-line";
          if (line.startsWith("+")) cls += " chat-diff-add";
          else if (line.startsWith("-")) cls += " chat-diff-remove";
          else if (line.startsWith("@@")) cls += " chat-diff-hunk";
          return (
            <div key={i} className={cls}>
              {line || "\u00A0"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
