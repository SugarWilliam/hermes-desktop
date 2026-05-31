import { memo, useState, useEffect, useCallback } from "react";
import { History, MessageSquare, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "../../components/useI18n";

// ── Types ─────────────────────────────────────────────

interface CachedSession {
  id: string;
  title: string;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
}

interface RelatedSessionsProps {
  profile?: string;
  onNewChat?: () => void;
}

// ── Helpers ───────────────────────────────────────────

const COLLAPSE_STORAGE_KEY = "hermes-related-sessions-collapsed";

function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    sessionStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore
  }
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts * 1000;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  return "over a year ago";
}

// ── Component ─────────────────────────────────────────

export const RelatedSessions = memo(function RelatedSessions({
  profile,
  onNewChat,
}: RelatedSessionsProps): React.JSX.Element | null {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<CachedSession[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await window.hermesAPI.listCachedSessions(5);
        if (!cancelled) {
          setSessions(list || []);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  // Don't render anything while loading or if no sessions
  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <div className="related-sessions">
      <button
        className="related-sessions-header"
        onClick={toggleCollapse}
        type="button"
        aria-expanded={!collapsed}
      >
        <span className="related-sessions-header-icon">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <History size={14} className="related-sessions-header-icon" />
        <span className="related-sessions-header-title">
          Recent Sessions
        </span>
        <span className="related-sessions-header-count">
          {sessions.length}
        </span>
      </button>

      {!collapsed && (
        <div className="related-sessions-list">
          {sessions.map((session) => (
            <div key={session.id} className="related-session-card">
              <div className="related-session-card-header">
                <span className="related-session-card-title" title={session.title}>
                  {session.title || t("chat.sessionTitle", { id: session.id.slice(-6) })}
                </span>
                <span className="related-session-card-model">{session.model}</span>
              </div>
              <div className="related-session-card-meta">
                <span className="related-session-card-meta-item">
                  <MessageSquare size={12} />
                  <span>
                    {session.messageCount}{" "}
                    {session.messageCount === 1
                      ? t("sessions.messageSingular")
                      : t("sessions.messages")}
                  </span>
                </span>
                <span className="related-session-card-meta-item">
                  <Clock size={12} />
                  <span>{formatRelativeTime(session.startedAt)}</span>
                </span>
              </div>
            </div>
          ))}

          {onNewChat && (
            <button
              className="related-sessions-new-chat"
              onClick={onNewChat}
              type="button"
            >
              {t("chat.newChat")}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default RelatedSessions;
