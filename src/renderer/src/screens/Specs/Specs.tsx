import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { Trash, FileText, CheckCircle, Clock, XCircle, Circle } from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface SpecEntry {
  title: string;
  status: string;
  created: string;
  sessionId: string;
  body: string;
}

interface SpecsProps {
  profile?: string;
}

// ── Status helpers ────────────────────────────────────

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  draft: Circle,
  approved: CheckCircle,
  in_progress: Clock,
  implemented: CheckCircle,
  rejected: XCircle,
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  implemented: "Done",
  rejected: "Rejected",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "specs-status--draft",
  approved: "specs-status--approved",
  in_progress: "specs-status--progress",
  implemented: "specs-status--done",
  rejected: "specs-status--rejected",
};

// ── Component ─────────────────────────────────────────

function Specs({ profile }: SpecsProps): React.JSX.Element {
  const { t } = useI18n();
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const loadSpecs = useCallback(async () => {
    try {
      setLoading(true);
      const list = await window.hermesAPI.listSpecs(profile);
      setSpecs(list || []);
    } catch {
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadSpecs();
  }, [loadSpecs]);

  const handleDelete = async (title: string) => {
    try {
      await window.hermesAPI.deleteSpec(title, profile);
      loadSpecs();
    } catch {
      // ignore
    }
  };

  const filtered = statusFilter
    ? specs.filter((s) => s.status === statusFilter)
    : specs;

  const statuses = ["draft", "approved", "in_progress", "implemented", "rejected"];

  return (
    <div className="specs-screen">
      <div className="specs-header">
        <h2 className="specs-title">
          <FileText size={20} />
          {t("navigation.specs")}
        </h2>
      </div>

      <p className="specs-desc">
        {t("specs.description")}
      </p>

      <div className="specs-filters">
        <button
          className={`specs-filter-btn ${!statusFilter ? "specs-filter-btn--active" : ""}`}
          onClick={() => setStatusFilter(null)}
          type="button"
        >
          {t("specs.all")}
        </button>
        {statuses.map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <button
              key={s}
              className={`specs-filter-btn ${statusFilter === s ? "specs-filter-btn--active" : ""}`}
              onClick={() => setStatusFilter(s === statusFilter ? null : s)}
              type="button"
            >
              <Icon size={12} />
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="specs-list">
        {loading ? (
          <div className="specs-loading">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="specs-empty">
            <FileText size={32} />
            <p>{t("specs.empty")}</p>
          </div>
        ) : (
          filtered.map((spec) => {
            const Icon = STATUS_ICONS[spec.status] || Circle;
            return (
              <div key={spec.title} className="specs-card">
                <div className="specs-card-main">
                  <Icon size={16} className={`specs-card-status ${STATUS_CLASSES[spec.status] || ""}`} />
                  <div className="specs-card-info">
                    <span className="specs-card-title">{spec.title}</span>
                    <span className="specs-card-meta">
                      <span className={`specs-status-badge ${STATUS_CLASSES[spec.status] || ""}`}>
                        {STATUS_LABELS[spec.status] || spec.status}
                      </span>
                      {spec.created && (
                        <span> · {new Date(spec.created).toLocaleDateString()}</span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  className="specs-card-delete"
                  onClick={() => handleDelete(spec.title)}
                  type="button"
                  title={t("common.delete")}
                >
                  <Trash size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Specs;
