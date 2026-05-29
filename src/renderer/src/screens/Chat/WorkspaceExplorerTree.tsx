import { memo, useCallback, useEffect, useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import {
  gitStatusToBadge,
  workspaceFileIcon,
  workspaceFileKind,
} from "./workspaceFileKind";

export interface WorkspaceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const INDENT_PX = 14;
const BASE_PAD_PX = 8;

interface WorkspaceExplorerTreeProps {
  root: string;
  selectedFile: string | null;
  onOpenFile: (path: string) => void;
  onEntryContextMenu: (e: React.MouseEvent, ent: WorkspaceEntry) => void;
}

export const WorkspaceExplorerTree = memo(function WorkspaceExplorerTree({
  root,
  selectedFile,
  onOpenFile,
  onEntryContextMenu,
}: WorkspaceExplorerTreeProps): React.JSX.Element {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const [childrenByDir, setChildrenByDir] = useState<
    Map<string, WorkspaceEntry[]>
  >(() => new Map());
  const [gitStatus, setGitStatus] = useState<
    Record<string, "modified" | "added" | "deleted" | "untracked">
  >({});

  const refreshGit = useCallback(async (): Promise<void> => {
    try {
      const map = await window.hermesAPI.workspaceGitStatus(root);
      setGitStatus(map);
    } catch {
      setGitStatus({});
    }
  }, [root]);

  const fetchDir = useCallback(
    async (dir: string): Promise<WorkspaceEntry[]> => {
      return window.hermesAPI.workspaceListDir(root, dir);
    },
    [root],
  );

  const ensureChildren = useCallback(
    async (dir: string): Promise<void> => {
      let alreadyLoaded = false;
      setChildrenByDir((prev) => {
        alreadyLoaded = prev.has(dir);
        return prev;
      });
      if (alreadyLoaded) return;
      try {
        const list = await fetchDir(dir);
        setChildrenByDir((prev) => {
          if (prev.has(dir)) return prev;
          const next = new Map(prev);
          next.set(dir, list);
          return next;
        });
      } catch {
        setChildrenByDir((prev) => {
          if (prev.has(dir)) return prev;
          const next = new Map(prev);
          next.set(dir, []);
          return next;
        });
      }
    },
    [fetchDir],
  );

  useEffect(() => {
    setExpandedDirs(new Set([root]));
    setChildrenByDir(new Map());
    void fetchDir(root).then((list) => {
      setChildrenByDir(new Map([[root, list]]));
    });
    void refreshGit();
    const timer = window.setInterval(() => {
      void refreshGit();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [root, fetchDir, refreshGit]);

  const toggleFolder = useCallback(
    (path: string): void => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          void ensureChildren(path);
        }
        return next;
      });
    },
    [ensureChildren],
  );

  const renderGitBadge = useCallback(
    (path: string): React.ReactNode => {
      const badge = gitStatusToBadge(gitStatus[path]);
      if (!badge) return null;
      return (
        <span
          className={`chat-workspace-git chat-workspace-git--${badge.toLowerCase()}`}
          title={badge}
        >
          {badge}
        </span>
      );
    },
    [gitStatus],
  );

  const renderEntries = useCallback(
    (dir: string, depth: number): React.ReactNode[] => {
      const entries = childrenByDir.get(dir);
      if (!entries) return [];

      return entries.flatMap((ent) => {
        const padLeft = BASE_PAD_PX + depth * INDENT_PX;
        const status = gitStatus[ent.path];
        const isModified = !!status;

        if (ent.isDirectory) {
          const isOpen = expandedDirs.has(ent.path);
          const kids = isOpen ? renderEntries(ent.path, depth + 1) : [];
          return [
            <button
              key={ent.path}
              type="button"
              className={`chat-workspace-entry chat-workspace-entry--folder ${
                isModified ? "chat-workspace-entry--git" : ""
              }`}
              style={{ paddingLeft: padLeft }}
              onClick={() => toggleFolder(ent.path)}
              onContextMenu={(e) => onEntryContextMenu(e, ent)}
            >
              <ChevronRight
                size={12}
                className={`chat-workspace-chevron ${
                  isOpen ? "chat-workspace-chevron--open" : ""
                }`}
                aria-hidden
              />
              {isOpen ? (
                <FolderOpen
                  size={14}
                  className="chat-workspace-entry-icon chat-workspace-entry-icon--folder"
                />
              ) : (
                <Folder
                  size={14}
                  className="chat-workspace-entry-icon chat-workspace-entry-icon--folder"
                />
              )}
              <span className="chat-workspace-name chat-workspace-name--folder">
                {ent.name}
              </span>
              {renderGitBadge(ent.path)}
            </button>,
            ...kids,
          ];
        }

        const kind = workspaceFileKind(ent.name);
        const FileIcon = workspaceFileIcon(ent.name);
        return [
          <button
            key={ent.path}
            type="button"
            className={`chat-workspace-entry chat-workspace-entry--file ${
              selectedFile === ent.path ? "chat-workspace-entry--active" : ""
            } ${isModified ? "chat-workspace-entry--git" : ""}`}
            style={{ paddingLeft: padLeft + 18 }}
            onClick={() => onOpenFile(ent.path)}
            onContextMenu={(e) => onEntryContextMenu(e, ent)}
          >
            <FileIcon
              size={14}
              className={`chat-workspace-entry-icon chat-workspace-file-icon--${kind}`}
            />
            <span className="chat-workspace-name chat-workspace-name--file">
              {ent.name}
            </span>
            {renderGitBadge(ent.path)}
          </button>,
        ];
      });
    },
    [
      childrenByDir,
      expandedDirs,
      gitStatus,
      onEntryContextMenu,
      onOpenFile,
      renderGitBadge,
      selectedFile,
      toggleFolder,
    ],
  );

  return (
    <div className="chat-workspace-tree">{renderEntries(root, 0)}</div>
  );
});
