import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import {
  Plus,
  Trash,
  Search,
  RefreshCw,
  Database,
  FileText,
  FolderOpen,
  FolderPlus,
  FilePlus,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface KBInfo {
  key: string;
  name: string;
  docCount: number;
  chunkCount: number;
  createdAt: number;
}

interface SearchResult {
  score: number;
  parentContent: string;
  subSnippet: string;
  docPath: string;
  sectionTitle: string;
  parentId: number;
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

  // Per-KB actions
  const [indexingKB, setIndexingKB] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<{
    key: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Per-KB search
  const [expandedKB, setExpandedKB] = useState<string | null>(null);
  const [kbSearchQuery, setKbSearchQuery] = useState("");
  const [kbSearchResults, setKbSearchResults] = useState<SearchResult[]>([]);
  const [kbSearching, setKbSearching] = useState(false);

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
      if (expandedKB === key) setExpandedKB(null);
      loadKBs();
    } catch {
      // ignore
    }
  };

  const handleIndexFolder = async (key: string) => {
    try {
      const docDir = await window.hermesAPI.selectFolder();
      if (!docDir) return;
      setIndexingKB(key);
      setIndexResult(null);
      const res = await window.hermesAPI.mragIndexKB(key, docDir, profile);
      setIndexResult({
        key,
        success: res.success,
        message: res.success
          ? `Indexed ${res.parentCount} documents (${res.subCount} chunks)`
          : `Indexing failed: ${(res.errors || []).join(", ") || "Unknown error"}`,
      });
      setIndexingKB(null);
      loadKBs();
    } catch (err) {
      setIndexResult({
        key,
        success: false,
        message: `Indexing error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
      setIndexingKB(null);
    }
  };

  const handleAddFile = async (key: string) => {
    try {
      const filePath = await window.hermesAPI.selectFile();
      if (!filePath) return;
      setIndexingKB(key);
      setIndexResult(null);
      const res = await window.hermesAPI.mragAddDoc(key, filePath, profile);
      setIndexResult({
        key,
        success: res.success,
        message: res.success
          ? `Added document (${res.parentCount} chunks)`
          : `Add failed: ${res.error || "Unknown error"}`,
      });
      setIndexingKB(null);
      loadKBs();
    } catch (err) {
      setIndexResult({
        key,
        success: false,
        message: `Add error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
      setIndexingKB(null);
    }
  };

  const handleKBSearch = async (key: string) => {
    if (!kbSearchQuery.trim()) return;
    setKbSearching(true);
    try {
      const results = await window.hermesAPI.mragSearchKB(
        key,
        kbSearchQuery.trim(),
        5,
        profile,
      );
      setKbSearchResults(results || []);
    } catch {
      setKbSearchResults([]);
    } finally {
      setKbSearching(false);
    }
  };

  const toggleExpandKB = (key: string) => {
    if (expandedKB === key) {
      setExpandedKB(null);
      setKbSearchResults([]);
      setKbSearchQuery("");
    } else {
      setExpandedKB(key);
      setKbSearchResults([]);
      setKbSearchQuery("");
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

      {/* Global index result feedback */}
      {indexResult && (
        <div
          className={`mrag-index-feedback ${indexResult.success ? "mrag-index-feedback--ok" : "mrag-index-feedback--err"}`}
        >
          {indexResult.success ? <Check size={14} /> : <X size={14} />}
          <span>{indexResult.message}</span>
          <button
            className="mrag-index-feedback-close"
            onClick={() => setIndexResult(null)}
            type="button"
          >
            <X size={12} />
          </button>
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
            <div key={kb.key} className="mrag-card-wrap">
              <div className="mrag-card">
                <div className="mrag-card-main">
                  <button
                    className="mrag-card-expand"
                    onClick={() => toggleExpandKB(kb.key)}
                    type="button"
                  >
                    {expandedKB === kb.key ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                  <FolderOpen size={18} className="mrag-card-icon" />
                  <div className="mrag-card-info">
                    <span className="mrag-card-name">{kb.name}</span>
                    <span className="mrag-card-meta">
                      {kb.docCount} {t("mrag.docs")} · {kb.chunkCount}{" "}
                      {t("mrag.chunks")}
                    </span>
                  </div>
                </div>
                <div className="mrag-card-actions">
                  <button
                    className="mrag-card-action-btn"
                    onClick={() => handleIndexFolder(kb.key)}
                    disabled={indexingKB === kb.key}
                    type="button"
                    title={t("mrag.indexFolder")}
                  >
                    {indexingKB === kb.key ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <FolderPlus size={14} />
                    )}
                  </button>
                  <button
                    className="mrag-card-action-btn"
                    onClick={() => handleAddFile(kb.key)}
                    disabled={indexingKB === kb.key}
                    type="button"
                    title={t("mrag.addFile")}
                  >
                    <FilePlus size={14} />
                  </button>
                  <button
                    className="mrag-card-delete"
                    onClick={() => handleDelete(kb.key)}
                    type="button"
                    title={t("common.delete")}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded search panel */}
              {expandedKB === kb.key && (
                <div className="mrag-card-search">
                  <div className="mrag-card-search-bar">
                    <Search size={13} />
                    <input
                      className="mrag-card-search-input"
                      placeholder={t("mrag.searchKBPlaceholder")}
                      value={kbSearchQuery}
                      onChange={(e) => setKbSearchQuery(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleKBSearch(kb.key)
                      }
                    />
                    <button
                      className="mrag-card-search-btn"
                      onClick={() => handleKBSearch(kb.key)}
                      disabled={kbSearching || !kbSearchQuery.trim()}
                      type="button"
                    >
                      {kbSearching ? (
                        <Loader2 size={13} className="spin" />
                      ) : (
                        t("mrag.search")
                      )}
                    </button>
                  </div>

                  {kbSearchResults.length > 0 && (
                    <div className="mrag-search-results">
                      {kbSearchResults.map((r, i) => (
                        <div key={i} className="mrag-search-result">
                          <div className="mrag-search-result-head">
                            <span className="mrag-search-result-doc">
                              {r.docPath.split("/").pop()}
                            </span>
                            {r.sectionTitle && (
                              <span className="mrag-search-result-section">
                                {r.sectionTitle}
                              </span>
                            )}
                            <span className="mrag-search-result-score">
                              {r.score.toFixed(2)}
                            </span>
                          </div>
                          <p className="mrag-search-result-snippet">
                            {r.subSnippet || r.parentContent.slice(0, 200)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {kbSearchResults.length === 0 &&
                    !kbSearching &&
                    kbSearchQuery && (
                      <p className="mrag-search-no-results">
                        {t("mrag.noSearchResults")}
                      </p>
                    )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Mrag;
