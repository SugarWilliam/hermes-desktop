import { memo, useCallback, useEffect, useState } from "react";
import {
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquarePlus,
  PanelLeft,
  PanelRight,
  Save,
} from "lucide-react";
import {
  WorkspaceExplorerTree,
  type WorkspaceEntry,
} from "./WorkspaceExplorerTree";
import { GitPanel } from "./GitPanel";
import { useI18n } from "../../components/useI18n";
import { AgentMarkdown } from "../../components/AgentMarkdown";
import { CodeEditor } from "../../components/CodeEditor";
import {
  formatWorkspaceFolderReference,
  formatWorkspaceSelectionReference,
} from "../../../../shared/workspaceContext";
import { WorkspaceExplorerResizer } from "./WorkspaceExplorerResizer";
import {
  readExplorerSide,
  toggleExplorerSide,
  type ExplorerSide,
} from "./workspaceExplorerSide";
import {
  readExplorerWidth,
  saveExplorerWidth,
} from "./workspaceExplorerWidth";

interface WorkspacePanelProps {
  root: string;
  /** Add a file as a path-ref attachment chip (no inline content in chat). */
  onAddFileRef: (absolutePath: string) => void;
  /** Append a one-line @-reference (folder / selection). */
  onAppendReference: (line: string) => void;
}

type MenuAction =
  | "add-file"
  | "add-folder"
  | "add-selection"
  | "open-file";

export const WorkspacePanel = memo(function WorkspacePanel({
  root,
  onAddFileRef,
  onAppendReference,
}: WorkspacePanelProps): React.JSX.Element {
  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [preview, setPreview] = useState(true);
  const [explorerSide, setExplorerSide] = useState<ExplorerSide>(readExplorerSide);
  const [explorerWidth, setExplorerWidth] = useState(readExplorerWidth);
  const [error, setError] = useState<string | null>(null);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<Record<string, "modified" | "added" | "deleted" | "untracked">>({});

  const loadGitStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await window.hermesAPI.workspaceGitStatus(root);
      setGitStatus(status);
    } catch {
      setGitStatus({});
    }
  }, [root]);

  useEffect(() => {
    if (root) loadGitStatus();
  }, [root, loadGitStatus]);

  const isMarkdown =
    selectedFile != null && /\.(md|markdown)$/i.test(selectedFile);

  const openFile = useCallback(
    async (path: string): Promise<void> => {
      try {
        setError(null);
        const { content, truncated: cut } =
          await window.hermesAPI.workspaceReadFile(root, path);
        setSelectedFile(path);
        setDraft(content);
        setTruncated(cut);
        setPreview(/\.(md|markdown)$/i.test(path));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [root],
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!selectedFile) return;
    try {
      await window.hermesAPI.workspaceWriteFile(root, selectedFile, draft);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [root, selectedFile, draft]);

  const handleAddFileToChat = useCallback((): void => {
    if (!selectedFile) return;
    onAddFileRef(selectedFile);
  }, [selectedFile, onAddFileRef]);

  const handlePickFiles = useCallback(async (): Promise<void> => {
    const paths = await window.hermesAPI.workspacePickFiles();
    for (const p of paths) {
      onAddFileRef(p);
    }
  }, [onAddFileRef]);

  const runMenuAction = useCallback(
    async (action: MenuAction, ent?: WorkspaceEntry): Promise<void> => {
      try {
        if (action === "add-folder" && ent?.isDirectory) {
          onAppendReference(formatWorkspaceFolderReference(ent.path));
          return;
        }
        if (action === "open-file" && ent && !ent.isDirectory) {
          await openFile(ent.path);
          return;
        }
        if (action === "add-file") {
          const path = ent?.path ?? selectedFile;
          if (!path || ent?.isDirectory) return;
          onAddFileRef(path);
          return;
        }
        if (action === "add-selection") {
          const sel =
            window.getSelection()?.toString() ?? "";
          if (!sel.trim()) return;
          onAppendReference(formatWorkspaceSelectionReference(selectedFile));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [onAddFileRef, onAppendReference, openFile, selectedFile],
  );

  const showContextMenu = useCallback(
    async (
      items: Array<{ id: MenuAction; label: string; enabled?: boolean }>,
      actionCtx?: WorkspaceEntry,
    ): Promise<void> => {
      const choice = await window.hermesAPI.showPopupMenu(
        items.map((item) => ({
          id: item.id,
          label: item.label,
          enabled: item.enabled,
        })),
      );
      if (choice) await runMenuAction(choice as MenuAction, actionCtx);
    },
    [runMenuAction],
  );

  const handleEntryContextMenu = useCallback(
    (e: React.MouseEvent, ent: WorkspaceEntry): void => {
      e.preventDefault();
      const items = ent.isDirectory
        ? [{ id: "add-folder" as const, label: t("chat.workspaceMenu.addFolder") }]
        : [
            { id: "add-file" as const, label: t("chat.workspaceMenu.addFile") },
            { id: "open-file" as const, label: t("chat.workspaceMenu.openFile") },
          ];
      void showContextMenu(items, ent);
    },
    [showContextMenu, t],
  );

  const handleEditorContextMenu = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      const hasSelection =
        preview && (window.getSelection()?.toString().trim().length ?? 0) > 0;
      const items: Array<{
        id: MenuAction;
        label: string;
        enabled?: boolean;
      }> = [];
      if (hasSelection) {
        items.push({
          id: "add-selection",
          label: t("chat.workspaceMenu.addSelection"),
        });
      }
      if (selectedFile) {
        items.push({
          id: "add-file",
          label: t("chat.workspaceMenu.addFile"),
        });
      }
      if (items.length === 0) return;
      void showContextMenu(items);
    },
    [preview, selectedFile, showContextMenu, t],
  );

  const handleExplorerWidthChange = useCallback((w: number): void => {
    setExplorerWidth(w);
    saveExplorerWidth(w);
  }, []);

  const handleToggleExplorerSide = useCallback((): void => {
    setExplorerSide((s) => toggleExplorerSide(s));
  }, []);

  const explorerPanel = (
    <div
      className="chat-workspace-explorer"
      style={{ width: explorerWidth, flexBasis: explorerWidth }}
    >
      <div className="chat-workspace-toolbar">
        <button
          type="button"
          className="btn-ghost chat-workspace-btn"
          onClick={() => void handlePickFiles()}
          title={t("chat.workspaceAddFiles")}
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          className="btn-ghost chat-workspace-btn"
          onClick={handleToggleExplorerSide}
          title={t("chat.workspaceMoveExplorer")}
        >
          {explorerSide === "right" ? (
            <PanelRight size={14} />
          ) : (
            <PanelLeft size={14} />
          )}
        </button>
        <button
          type="button"
          className={`btn-ghost chat-workspace-btn ${gitPanelOpen ? "chat-workspace-btn--active" : ""}`}
          onClick={() => { setGitPanelOpen((p) => !p); if (!gitPanelOpen) loadGitStatus(); }}
          title={t("chat.git.title")}
        >
          <GitBranch size={14} />
        </button>
      </div>
      {error && <div className="chat-workspace-error">{error}</div>}
      <WorkspaceExplorerTree
        root={root}
        selectedFile={selectedFile}
        onOpenFile={(path) => void openFile(path)}
        onEntryContextMenu={handleEntryContextMenu}
      />
      {gitPanelOpen && (
        <GitPanel
          workspaceRoot={root}
          gitStatus={gitStatus}
          onRefresh={loadGitStatus}
        />
      )}
    </div>
  );

  const editorPanel = (
    <div className="chat-workspace-main">
      {selectedFile ? (
        <>
          <div className="chat-workspace-main-toolbar">
            <div className="chat-workspace-file-label" title={selectedFile}>
              {selectedFile.split(/[\\/]/).pop()}
              {truncated && (
                <span className="chat-workspace-truncated">
                  {t("chat.workspaceTruncated")}
                </span>
              )}
            </div>
            <div className="chat-workspace-main-actions">
              <button
                type="button"
                className="btn-ghost chat-workspace-btn"
                onClick={handleAddFileToChat}
                title={t("chat.workspaceAddToChat")}
              >
                <MessageSquarePlus size={14} />
              </button>
              {isMarkdown && (
                <button
                  type="button"
                  className={`btn-ghost chat-workspace-btn ${preview ? "chat-workspace-btn--active" : ""}`}
                  onClick={() => setPreview((p) => !p)}
                >
                  <FileText size={14} />
                </button>
              )}
              <button
                type="button"
                className="btn-ghost chat-workspace-btn"
                onClick={() => void handleSave()}
                title={t("chat.workspaceSave")}
              >
                <Save size={14} />
              </button>
            </div>
          </div>
          <div
            className="chat-workspace-editor"
            onContextMenu={handleEditorContextMenu}
          >
            {isMarkdown && preview ? (
              <div className="chat-workspace-preview">
                <AgentMarkdown variant="document">{draft}</AgentMarkdown>
              </div>
            ) : (
              <CodeEditor
                filePath={selectedFile}
                value={draft}
                onChange={setDraft}
                onSave={handleSave}
              />
            )}
          </div>
        </>
      ) : (
        <div className="chat-workspace-empty">
          {t("chat.workspacePickFileHint")}
        </div>
      )}
    </div>
  );

  return (
    <aside className="chat-workspace" aria-label={t("chat.workspaceTitle")}>
      <div
        className={`chat-workspace-inner chat-workspace-inner--explorer-${explorerSide}`}
      >
        {explorerSide === "left" ? (
          <>
            {explorerPanel}
            <WorkspaceExplorerResizer
              width={explorerWidth}
              side={explorerSide}
              onWidthChange={handleExplorerWidthChange}
            />
            {editorPanel}
          </>
        ) : (
          <>
            {editorPanel}
            <WorkspaceExplorerResizer
              width={explorerWidth}
              side={explorerSide}
              onWidthChange={handleExplorerWidthChange}
            />
            {explorerPanel}
          </>
        )}
      </div>
    </aside>
  );
});
