import { useState, useCallback, useEffect, useRef } from "react";
import Chat, { ChatMessage } from "../Chat/Chat";
import {
  dbItemsToChatMessages,
  type DbHistoryItem,
} from "../Chat/sessionHistory";
import Sessions from "../Sessions/Sessions";
import Agents from "../Agents/Agents";
import Settings from "../Settings/Settings";
import Skills from "../Skills/Skills";
import Soul from "../Soul/Soul";
import Memory from "../Memory/Memory";
import Tools from "../Tools/Tools";
import Gateway from "../Gateway/Gateway";
import Office from "../Office/Office";
import Models from "../Models/Models";
import Providers from "../Providers/Providers";
import Schedules from "../Schedules/Schedules";
import Kanban from "../Kanban/Kanban";
import { RulesEditor } from "../../components/RulesEditor";
import Mrag from "../Mrag/Mrag";
import Specs from "../Specs/Specs";
import RemoteNotice from "../../components/RemoteNotice";
import VerifyWarningBanner from "../../components/VerifyWarningBanner";
import { Download, PanelLeft, PanelLeftClose } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import {
  NAV_GROUPS,
  readSidebarExpanded,
  SIDEBAR_EXPANDED_KEY,
  type NavView,
} from "./sidebarNav";

type View = NavView;

interface LayoutProps {
  verifyWarning?: boolean;
  onReinstall?: () => void;
  onDismissVerifyWarning?: () => void;
}

function Layout({
  verifyWarning,
  onReinstall,
  onDismissVerifyWarning,
}: LayoutProps = {}): React.JSX.Element {
  const { t } = useI18n();
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  /** Bumps on new chat / resume — not when the gateway re-keys the same conversation. */
  const [chatConversationKey, setChatConversationKey] = useState(0);
  const [activeProfile, setActiveProfile] = useState("default");
  // Tabs lazy-mount on first visit, then stay mounted (display:none toggle).
  // Keeps IPC refetch / DOM rebuild off the tab-switch hot path.
  const [visitedViews, setVisitedViews] = useState<Set<View>>(
    () => new Set<View>(["chat"]),
  );
  // Remote-only mode — SSH tunnel has full access; only pure HTTP remote mode restricts screens
  const [sidebarExpanded, setSidebarExpanded] = useState(readSidebarExpanded);
  const [remoteMode, setRemoteMode] = useState(false);

  const paneStyle = (target: View): React.CSSProperties => ({
    display: view === target ? "flex" : "none",
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  });

  const goTo = useCallback((v: View) => {
    setVisitedViews((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
    setView(v);
  }, []);

  // Re-check remote mode on tab switch (picks up Settings changes)
  useEffect(() => {
    window.hermesAPI.isRemoteOnlyMode().then(setRemoteMode);
  }, [view]);

  // Auto-update state
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<
    "available" | "downloading" | "ready" | "error" | null
  >(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const cleanupAvailable = window.hermesAPI.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState("available");
      setUpdateError(null);
      setDownloadPercent(0);
    });
    const cleanupProgress = window.hermesAPI.onUpdateDownloadProgress(
      (info) => {
        setDownloadPercent(info.percent);
      },
    );
    const cleanupDownloaded = window.hermesAPI.onUpdateDownloaded(() => {
      setUpdateState("ready");
      setUpdateError(null);
    });
    const cleanupError = window.hermesAPI.onUpdateError((message) => {
      setUpdateState("error");
      setUpdateError(message);
      setDownloadPercent(0);
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  async function handleUpdate(): Promise<void> {
    if (updateState === "available" || updateState === "error") {
      setUpdateError(null);
      setDownloadPercent(0);
      setUpdateState("downloading");
      try {
        const ok = await window.hermesAPI.downloadUpdate();
        if (!ok) setUpdateState("error");
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : String(err));
        setUpdateState("error");
      }
    } else if (updateState === "ready") {
      await window.hermesAPI.installUpdate();
    }
  }

  const handleNewChat = useCallback(() => {
    // Abort any in-flight chat before clearing
    window.hermesAPI.abortChat();
    setMessages([]);
    setCurrentSessionId(null);
    setChatConversationKey((k) => k + 1);
    goTo("chat");
  }, [goTo]);

  // Listen for menu IPC events (Cmd+N, Cmd+K from app menu)
  useEffect(() => {
    const cleanupNewChat = window.hermesAPI.onMenuNewChat(() => {
      handleNewChat();
    });
    const cleanupSearch = window.hermesAPI.onMenuSearchSessions(() => {
      goTo("sessions");
    });
    return () => {
      cleanupNewChat();
      cleanupSearch();
    };
  }, [handleNewChat, goTo]);

  // Global keyboard shortcuts from keybindings config
  const keybindingsRef = useRef<Array<{ id: string; key: string }>>([]);
  useEffect(() => {
    window.hermesAPI.getKeybindings(activeProfile).then((kbs) => {
      keybindingsRef.current = kbs.map((kb) => ({ id: kb.id, key: kb.key }));
    });
  }, [activeProfile]);

  useEffect(() => {
    function matchKeyCombo(combo: string, e: KeyboardEvent): boolean {
      const parts = combo.split("+");
      const needCtrl = parts.includes("CmdOrCtrl");
      const needShift = parts.includes("Shift");
      const needAlt = parts.includes("Alt");
      const mainKey = parts.filter((p) => !["CmdOrCtrl", "Shift", "Alt"].includes(p))[0];
      if (!mainKey) return false;
      const ctrlOk = needCtrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftOk = needShift ? e.shiftKey : !e.shiftKey;
      const altOk = needAlt ? e.altKey : !e.altKey;
      const keyOk = e.key.toUpperCase() === mainKey.toUpperCase() || e.code === `Key${mainKey}`;
      return ctrlOk && shiftOk && altOk && keyOk;
    }

    function handleGlobalKeydown(e: KeyboardEvent): void {
      // Skip if in an input/textarea/contenteditable
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      for (const kb of keybindingsRef.current) {
        if (matchKeyCombo(kb.key, e)) {
          e.preventDefault();
          switch (kb.id) {
            case "newChat": handleNewChat(); break;
            case "clearChat":
              window.hermesAPI.abortChat();
              setMessages([]);
              setCurrentSessionId(null);
              setChatConversationKey((k) => k + 1);
              break;
            case "goToSettings": goTo("settings"); break;
            case "goToSessions": goTo("sessions"); break;
            case "focusInput": {
              const input = document.querySelector(".chat-input textarea, .chat-input input") as HTMLElement | null;
              input?.focus();
              break;
            }
            case "toggleWorkspace": {
              const btn = document.querySelector(".workspace-toggle-btn") as HTMLElement | null;
              btn?.click();
              break;
            }
            case "toggleFastMode": {
              // Toggle fast mode via the chat header control
              const fastBtn = document.querySelector(".chat-mode-select button, [data-testid='fast-mode-toggle']") as HTMLElement | null;
              fastBtn?.click();
              break;
            }
          }
          return;
        }
      }
    }
    document.addEventListener("keydown", handleGlobalKeydown);
    return () => document.removeEventListener("keydown", handleGlobalKeydown);
  }, [handleNewChat, goTo]);

  const handleSelectProfile = useCallback((name: string) => {
    window.hermesAPI.abortChat();
    setActiveProfile(name);
    setMessages([]);
    setCurrentSessionId(null);
    setChatConversationKey((k) => k + 1);
  }, []);

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      window.hermesAPI.abortChat();
      const items = (await window.hermesAPI.getSessionMessages(
        sessionId,
      )) as DbHistoryItem[];
      setMessages(dbItemsToChatMessages(items));
      setCurrentSessionId(sessionId);
      setChatConversationKey((k) => k + 1);
      goTo("chat");
    },
    [goTo],
  );

  const handleForkSession = useCallback(
    (newSessionId: string) => {
      handleResumeSession(newSessionId);
    },
    [handleResumeSession],
  );

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className="layout">
      <aside
        className={`sidebar ${sidebarExpanded ? "sidebar--expanded" : "sidebar--collapsed"}`}
      >
        <div className="sidebar-brand">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={t(
              sidebarExpanded
                ? "navigation.collapseSidebar"
                : "navigation.expandSidebar",
            )}
            title={t(
              sidebarExpanded
                ? "navigation.collapseSidebar"
                : "navigation.expandSidebar",
            )}
          >
            {sidebarExpanded ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeft size={18} />
            )}
          </button>
          {sidebarExpanded && (
            <span className="sidebar-brand-name">{t("common.appName")}</span>
          )}
        </div>

        <nav className="sidebar-nav" aria-label={t("navigation.main")}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className="sidebar-nav-group">
              {gi > 0 && <div className="sidebar-nav-divider" aria-hidden />}
              {sidebarExpanded && group.labelKey && (
                <div className="sidebar-nav-group-label">{t(group.labelKey)}</div>
              )}
              {group.items.map(({ view: v, icon: Icon, labelKey }) => (
                <button
                  key={v}
                  type="button"
                  className={`sidebar-nav-item ${view === v ? "active" : ""}`}
                  onClick={() => goTo(v)}
                  title={t(labelKey)}
                  aria-label={t(labelKey)}
                >
                  <Icon size={18} />
                  {sidebarExpanded && (
                    <span className="sidebar-nav-label">{t(labelKey)}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {updateState && (
            <button
              className={`sidebar-update-btn ${
                updateState === "error" ? "error" : ""
              }`}
              onClick={handleUpdate}
              disabled={updateState === "downloading"}
              title={updateError ?? undefined}
            >
              <Download size={13} />
              {sidebarExpanded && (
                <>
                  {updateState === "available" && (
                    <span>
                      {t("common.updateAvailable", { version: updateVersion })}
                    </span>
                  )}
                  {updateState === "downloading" && (
                    <span>
                      {t("common.downloading", { percent: downloadPercent })}
                    </span>
                  )}
                  {updateState === "ready" && (
                    <span>{t("common.restartToUpdate")}</span>
                  )}
                  {updateState === "error" && (
                    <span>{t("common.updateFailed")}</span>
                  )}
                </>
              )}
            </button>
          )}
          {sidebarExpanded && (
            <div className="sidebar-footer-text">
              {activeProfile === "default"
                ? t("common.appName")
                : activeProfile}
            </div>
          )}
        </div>
      </aside>

      <main className="content">
        {verifyWarning && onReinstall && onDismissVerifyWarning && (
          <VerifyWarningBanner
            onReinstall={onReinstall}
            onDismiss={onDismissVerifyWarning}
          />
        )}
        <div style={paneStyle("chat")}>
          <Chat
            messages={messages}
            setMessages={setMessages}
            sessionId={currentSessionId}
            conversationKey={chatConversationKey}
            profile={activeProfile}
            onSessionIdChange={setCurrentSessionId}
            onNewChat={handleNewChat}
            onForkSession={handleForkSession}
          />
        </div>

        {visitedViews.has("sessions") && (
          <div style={paneStyle("sessions")}>
            {remoteMode ? (
              <RemoteNotice feature="Sessions" />
            ) : (
              <Sessions
                onResumeSession={handleResumeSession}
                onNewChat={handleNewChat}
                currentSessionId={currentSessionId}
                visible={view === "sessions"}
              />
            )}
          </div>
        )}

        {visitedViews.has("agents") && (
          <div style={paneStyle("agents")}>
            {remoteMode ? (
              <RemoteNotice feature="Profiles" />
            ) : (
              <Agents
                activeProfile={activeProfile}
                onSelectProfile={handleSelectProfile}
                onChatWith={(name: string) => {
                  handleSelectProfile(name);
                  goTo("chat");
                }}
              />
            )}
          </div>
        )}

        {visitedViews.has("office") && (
          <div style={paneStyle("office")}>
            <Office profile={activeProfile} visible={view === "office"} />
          </div>
        )}

        {visitedViews.has("models") && (
          <div style={paneStyle("models")}>
            <Models visible={view === "models"} />
          </div>
        )}

        {visitedViews.has("providers") && (
          <div style={paneStyle("providers")}>
            {remoteMode ? (
              <RemoteNotice feature="Providers" />
            ) : (
              <Providers
                profile={activeProfile}
                visible={view === "providers"}
              />
            )}
          </div>
        )}

        {visitedViews.has("skills") && (
          <div style={paneStyle("skills")}>
            {remoteMode ? (
              <RemoteNotice feature="Skills" />
            ) : (
              <Skills profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("soul") && (
          <div style={paneStyle("soul")}>
            {remoteMode ? (
              <RemoteNotice feature="Persona" />
            ) : (
              <Soul profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("memory") && (
          <div style={paneStyle("memory")}>
            {remoteMode ? (
              <RemoteNotice feature="Memory" />
            ) : (
              <Memory profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("tools") && (
          <div style={paneStyle("tools")}>
            {remoteMode ? (
              <RemoteNotice feature="Tools" />
            ) : (
              <Tools profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("schedules") && (
          <div style={paneStyle("schedules")}>
            <Schedules profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("kanban") && (
          <div style={paneStyle("kanban")}>
            {remoteMode ? (
              <RemoteNotice feature="Kanban" />
            ) : (
              <Kanban profile={activeProfile} visible={view === "kanban"} />
            )}
          </div>
        )}

        {visitedViews.has("gateway") && (
          <div style={paneStyle("gateway")}>
            {remoteMode ? (
              <RemoteNotice feature="Gateway" />
            ) : (
              <Gateway profile={activeProfile} />
            )}
          </div>
        )}


        {visitedViews.has("rules") && (
          <div style={paneStyle("rules")}>
            <RulesEditor profile={activeProfile} onClose={() => goTo("chat")} />
          </div>
        )}

        {visitedViews.has("mrag") && (
          <div style={paneStyle("mrag")}>
            <Mrag profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("specs") && (
          <div style={paneStyle("specs")}>
            <Specs profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("settings") && (
          <div style={paneStyle("settings")}>
            <Settings profile={activeProfile} />
          </div>
        )}
      </main>
    </div>
  );
}

export default Layout;
