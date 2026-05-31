import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { Plus, Trash, Search, RefreshCw, Database, FileText, FolderOpen } from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface KBInfo {
  key: string;
  name: string;
  docCount: number;
  chunkCount: number;
  createdAt: number;
}

interface MragProps {
  profile?: string;
}

// ── Component ─────────────────────────────────────────

function Mrag({ profile }: MragProps): React.JSX.Element {
  const { t } = useI18n();
  const [kbs, setKbs] = useState<KBInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKBName, setNewKBName] = useState("");
  const [createError, setCreateError] = useState("");

  const loadKBs = useCallback(async () => {
    try {
      setLoading(true);
      const list = await window.hermesAPI.mragListKBs(profile);
      setKbs(list || []);
    } catch {
      setKbs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadKBs();
  }, [loadKBs]);

  const handleCreate = async () => {
    const name = newKBName.trim();
    if (!name) {
      setCreateError(t("mrag.nameRequired"));
      return;
    }
    try {
      const res = await window.hermesAPI.mragCreateKB(name, profile);
      if (res.success) {
        setNewKBName("");
        setCreating(false);
        setCreateError("");
        loadKBs();
      } else {
        setCreateError(res.error || t("mrag.createFailed"));
      }
    } catch {
      setCreateError(t("mrag.createFailed"));
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await window.hermesAPI.mragDeleteKB(key, profile);
      loadKBs();
    } catch {
      // ignore
    }
  };

  const filtered = kbs.filter(
    (kb) =>
      !searchQuery ||
      kb.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="mrag-screen">
      <div className="mrag-header">
        <h2 className="mrag-title">
          <Database size={20} />
          {t("navigation.mrag")}
        </h2>
        <button
          className="mrag-create-btn"
          onClick={() => setCreating(true)}
          type="button"
        >
          <Plus size={16} />
          {t("mrag.create")}
        </button>
      </div>

      <p className="mrag-desc">
        {t("mrag.description")}
      </p>

      <div className="mrag-toolbar">
        <div className="mrag-search">
          <Search size={14} />
          <input
            className="mrag-search-input"
            placeholder={t("mrag.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="mrag-refresh-btn"
          onClick={loadKBs}
          type="button"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {creating && (
        <div className="mrag-create-panel">
          <input
            className="mrag-create-input"
            placeholder={t("mrag.namePlaceholder")}
            value={newKBName}
            onChange={(e) => {
              setNewKBName(e.target.value);
              setCreateError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <button className="mrag-create-confirm" onClick={handleCreate} type="button">
            {t("common.create")}
          </button>
          <button
            className="mrag-create-cancel"
            onClick={() => {
              setCreating(false);
              setNewKBName("");
              setCreateError("");
            }}
            type="button"
          >
            {t("common.cancel")}
          </button>
          {createError && <span className="mrag-create-error">{createError}</span>}
        </div>
      )}

      <div className="mrag-list">
        {loading ? (
          <div className="mrag-loading">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="mrag-empty">
            <FileText size={32} />
            <p>{t("mrag.empty")}</p>
          </div>
        ) : (
          filtered.map((kb) => (
            <div key={kb.key} className="mrag-card">
              <div className="mrag-card-main">
                <FolderOpen size={18} className="mrag-card-icon" />
                <div className="mrag-card-info">
                  <span className="mrag-card-name">{kb.name}</span>
                  <span className="mrag-card-meta">
                    {kb.docCount} {t("mrag.docs")} · {kb.chunkCount} {t("mrag.chunks")}
                  </span>
                </div>
              </div>
              <button
                className="mrag-card-delete"
                onClick={() => handleDelete(kb.key)}
                type="button"
                title={t("common.delete")}
              >
                <Trash size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Mrag;
