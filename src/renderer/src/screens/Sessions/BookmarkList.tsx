import { useState, useEffect, useCallback } from "react";
import { Bookmark, Trash2, Edit3 } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface BookmarkItem {
  id: number;
  sessionId: string;
  messageId: number;
  note: string;
  createdAt: number;
  sessionTitle?: string | null;
}

interface BookmarkListProps {
  onNavigate: (sessionId: string, messageId: number) => void;
}

export function BookmarkList({ onNavigate }: BookmarkListProps): React.JSX.Element {
  const { t } = useI18n();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");

  const loadBookmarks = useCallback(async (): Promise<void> => {
    const list = await window.hermesAPI.listBookmarks();
    setBookmarks(list);
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  async function handleRemove(id: number): Promise<void> {
    await window.hermesAPI.removeBookmark(id);
    loadBookmarks();
  }

  async function handleSaveNote(id: number): Promise<void> {
    await window.hermesAPI.updateBookmarkNote(id, editNote);
    setEditingId(null);
    setEditNote("");
    loadBookmarks();
  }

  function startEdit(bm: BookmarkItem): void {
    setEditingId(bm.id);
    setEditNote(bm.note);
  }

  return (
    <div className="bookmark-list">
      <div className="bookmark-list-header">
        <Bookmark size={16} />
        <span>{t("sessions.bookmarksTitle")}</span>
        <span className="bookmark-count">{bookmarks.length}</span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="bookmark-empty">{t("sessions.bookmarksEmpty")}</div>
      ) : (
        <div className="bookmark-items">
          {bookmarks.map((bm) => (
            <div key={bm.id} className="bookmark-item">
              <div className="bookmark-item-header">
                <span
                  className="bookmark-session"
                  onClick={() => onNavigate(bm.sessionId, bm.messageId)}
                  title={t("sessions.bookmarksNavigateTo")}
                >
                  {bm.sessionTitle || bm.sessionId.slice(0, 12)}
                </span>
                <span className="bookmark-date">
                  {new Date(bm.createdAt * 1000).toLocaleDateString()}
                </span>
              </div>

              {editingId === bm.id ? (
                <div className="bookmark-edit-row">
                  <input
                    className="bookmark-edit-input"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveNote(bm.id)}
                    autoFocus
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleSaveNote(bm.id)}
                    type="button"
                  >
                    {t("sessions.bookmarksSave")}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setEditingId(null)}
                    type="button"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <div className="bookmark-note">
                  {bm.note || <span className="bookmark-no-note">{t("sessions.bookmarksNoNote")}</span>}
                </div>
              )}

              <div className="bookmark-actions">
                <button
                  className="btn-ghost bookmark-action-btn"
                  onClick={() => startEdit(bm)}
                  title={t("sessions.bookmarksEditNote")}
                  type="button"
                >
                  <Edit3 size={12} />
                </button>
                <button
                  className="btn-ghost bookmark-action-btn"
                  onClick={() => handleRemove(bm.id)}
                  title={t("sessions.bookmarksRemove")}
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
