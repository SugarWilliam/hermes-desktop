import { useState, useEffect, useCallback } from "react";
import { GitBranch, GitCommit, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface GitPanelProps {
  workspaceRoot: string;
  gitStatus: Record<string, "modified" | "added" | "deleted" | "untracked">;
  onRefresh: () => void;
}

export function GitPanel({ workspaceRoot, gitStatus, onRefresh }: GitPanelProps): React.JSX.Element {
  const { t } = useI18n();
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ current: string; branches: string[] }>({
    current: "",
    branches: [],
  });
  const [diffContent, setDiffContent] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    const result = await window.hermesAPI.gitBranches(workspaceRoot);
    setBranches(result);
  }, [workspaceRoot]);

  useEffect(() => {
    if (workspaceRoot) loadBranches();
  }, [workspaceRoot, loadBranches]);

  const changedFiles = Object.entries(gitStatus);
  const hasChanges = changedFiles.length > 0;

  async function handleCommit(): Promise<void> {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    setStatusMsg(null);
    const result = await window.hermesAPI.gitCommit(workspaceRoot, commitMsg.trim());
    setCommitting(false);
    if (result.success) {
      setCommitMsg("");
      setStatusMsg(t("chat.git.committed"));
      onRefresh();
      loadBranches();
    } else {
      setStatusMsg(result.error || t("chat.git.commitFailed"));
    }
  }

  async function handlePush(): Promise<void> {
    setPushing(true);
    setStatusMsg(null);
    const result = await window.hermesAPI.gitPush(workspaceRoot);
    setPushing(false);
    if (result.success) {
      setStatusMsg(t("chat.git.pushed"));
    } else {
      setStatusMsg(result.error || t("chat.git.pushFailed"));
    }
  }

  async function handlePull(): Promise<void> {
    setPulling(true);
    setStatusMsg(null);
    const result = await window.hermesAPI.gitPull(workspaceRoot);
    setPulling(false);
    if (result.success) {
      setStatusMsg(result.output || t("chat.git.pulled"));
      onRefresh();
    } else {
      setStatusMsg(result.error || t("chat.git.pullFailed"));
    }
  }

  async function handleSwitchBranch(branch: string): Promise<void> {
    setStatusMsg(null);
    const result = await window.hermesAPI.gitSwitchBranch(workspaceRoot, branch);
    if (result.success) {
      loadBranches();
      onRefresh();
      setStatusMsg(t("chat.git.switchedTo", { branch }));
    } else {
      setStatusMsg(result.error || t("chat.git.switchFailed"));
    }
  }

  async function handleViewDiff(file: string): Promise<void> {
    const diff = await window.hermesAPI.gitDiff(workspaceRoot, file);
    setDiffContent(diff || t("chat.git.noDiff"));
  }

  const relPath = (abs: string): string => {
    const root = workspaceRoot.endsWith("/") || workspaceRoot.endsWith("\\")
      ? workspaceRoot
      : workspaceRoot + "/";
    return abs.startsWith(root) ? abs.slice(root.length) : abs;
  };

  const statusColor = (s: string): string => {
    switch (s) {
      case "added": return "#22c55e";
      case "deleted": return "#ef4444";
      case "untracked": return "#f59e0b";
      default: return "#60a5fa";
    }
  };

  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <GitBranch size={14} />
        <span>{t("chat.git.title")}</span>
        {branches.current && (
          <span className="git-branch-badge">{branches.current}</span>
        )}
      </div>

      {branches.branches.length > 1 && (
        <div className="git-branches">
          {branches.branches.map((b) => (
            <button
              key={b}
              className={`git-branch-btn ${b === branches.current ? "active" : ""}`}
              onClick={() => b !== branches.current && handleSwitchBranch(b)}
              disabled={b === branches.current}
              type="button"
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <div className="git-actions-row">
        <button
          className="git-action-btn"
          onClick={handlePull}
          disabled={pulling}
          title={t("chat.git.pull")}
          type="button"
        >
          <ArrowDown size={12} />
          {pulling ? "..." : t("chat.git.pull")}
        </button>
        <button
          className="git-action-btn"
          onClick={handlePush}
          disabled={pushing}
          title={t("chat.git.push")}
          type="button"
        >
          <ArrowUp size={12} />
          {pushing ? "..." : t("chat.git.push")}
        </button>
        <button
          className="git-action-btn"
          onClick={onRefresh}
          title={t("chat.git.refresh")}
          type="button"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {hasChanges ? (
        <div className="git-file-list">
          {changedFiles.map(([absPath, status]) => (
            <div key={absPath} className="git-file-row">
              <span className="git-file-status" style={{ color: statusColor(status) }}>
                {status[0].toUpperCase()}
              </span>
              <span
                className="git-file-name"
                onClick={() => handleViewDiff(relPath(absPath))}
                title={t("chat.git.viewDiff")}
              >
                {relPath(absPath)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="git-no-changes">{t("chat.git.noChanges")}</div>
      )}

      <div className="git-commit-row">
        <input
          className="git-commit-input"
          placeholder={t("chat.git.commitPlaceholder")}
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleCommit()}
        />
        <button
          className="git-commit-btn"
          onClick={handleCommit}
          disabled={committing || !commitMsg.trim() || !hasChanges}
          type="button"
        >
          <GitCommit size={12} />
          {committing ? "..." : t("chat.git.commit")}
        </button>
      </div>

      {statusMsg && (
        <div className="git-status-msg">{statusMsg}</div>
      )}

      {diffContent !== null && (
        <div className="git-diff-preview">
          <div className="git-diff-header">
            <span>{t("chat.git.diff")}</span>
            <button onClick={() => setDiffContent(null)} type="button">×</button>
          </div>
          <pre className="git-diff-content">{diffContent}</pre>
        </div>
      )}
    </div>
  );
}
