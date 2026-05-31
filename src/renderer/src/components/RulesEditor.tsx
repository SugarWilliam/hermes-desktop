import { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  FileText,
  Globe,
  Brain,
  Filter,
} from "lucide-react";

interface RuleMeta {
  name: string;
  type: "always_on" | "model_decision" | "glob";
  glob: string;
  description: string;
  priority: number;
  path: string;
}

interface RuleContent {
  meta: RuleMeta;
  body: string;
}

interface RulesEditorProps {
  profile?: string;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  always_on: "Always On",
  model_decision: "Model Decision",
  glob: "Glob",
};

const TYPE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  always_on: Brain,
  model_decision: Filter,
  glob: Globe,
};

export function RulesEditor({
  profile,
  onClose,
}: RulesEditorProps): React.JSX.Element {
  const [rules, setRules] = useState<RuleMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<RuleMeta["type"]>("model_decision");
  const [formGlob, setFormGlob] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formBody, setFormBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const list = await window.hermesAPI.listRules(profile);
      setRules(list);
    } catch {
      setError("Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const openEdit = useCallback(async (meta: RuleMeta) => {
    setError("");
    try {
      const content = (await window.hermesAPI.readRuleContent(
        meta.path,
      )) as RuleContent | null;
      if (content) {
        setFormName(content.meta.name);
        setFormType(content.meta.type);
        setFormGlob(content.meta.glob);
        setFormDescription(content.meta.description);
        setFormPriority(content.meta.priority);
        setFormBody(content.body);
        setEditing(content.meta.name);
        setCreating(false);
      }
    } catch {
      setError("Failed to read rule content");
    }
  }, []);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormType("model_decision");
    setFormGlob("");
    setFormDescription("");
    setFormPriority(0);
    setFormBody("");
    setEditing(null);
    setCreating(false);
    setError("");
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setCreating(true);
  }, [resetForm]);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const result = await window.hermesAPI.updateRule(
          editing,
          {
            type: formType,
            glob: formGlob,
            description: formDescription,
            body: formBody,
            priority: formPriority,
          },
          profile,
        );
        if (!result.success) setError(result.error || "Failed to update rule");
      } else {
        const result = await window.hermesAPI.createRule(
          formName,
          formType,
          formGlob,
          formDescription,
          formBody,
          formPriority,
          profile,
        );
        if (!result.success) setError(result.error || "Failed to create rule");
      }
      resetForm();
      void loadRules();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [
    formName,
    formType,
    formGlob,
    formDescription,
    formBody,
    formPriority,
    editing,
    profile,
    resetForm,
    loadRules,
  ]);

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        const result = await window.hermesAPI.deleteRule(name, profile);
        if (!result.success) {
          setError(result.error || "Failed to delete rule");
        } else {
          setDeleteConfirm(null);
          if (editing === name) resetForm();
          void loadRules();
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [editing, profile, resetForm, loadRules],
  );

  const showForm = editing || creating;

  return (
    <div
      className="rules-editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rules-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-editor-header">
          <h2 className="rules-editor-title">Rules</h2>
          <button
            className="rules-editor-close"
            onClick={onClose}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && <div className="rules-editor-error">{error}</div>}

        <div className="rules-editor-toolbar">
          <button
            className="rules-editor-btn rules-editor-btn--primary"
            onClick={startCreate}
          >
            <Plus size={14} />
            New Rule
          </button>
        </div>

        <div className="rules-editor-body">
          <div
            className={`rules-editor-list ${showForm ? "rules-editor-list--narrow" : ""}`}
          >
            {loading ? (
              <div className="rules-editor-empty">Loading...</div>
            ) : rules.length === 0 && !creating ? (
              <div className="rules-editor-empty">No rules yet</div>
            ) : (
              rules.map((rule) => {
                const TypeIcon = TYPE_ICONS[rule.type] || FileText;
                return (
                  <div
                    key={rule.name}
                    className={`rules-editor-item ${editing === rule.name ? "rules-editor-item--active" : ""}`}
                    onClick={() => {
                      void openEdit(rule);
                    }}
                  >
                    <TypeIcon size={14} className="rules-editor-item-icon" />
                    <div className="rules-editor-item-info">
                      <span className="rules-editor-item-name">
                        {rule.name}
                      </span>
                      <span className="rules-editor-item-meta">
                        <span
                          className={`rules-badge rules-badge--${rule.type}`}
                        >
                          {TYPE_LABELS[rule.type]}
                        </span>
                        {rule.glob && (
                          <span className="rules-editor-item-glob">
                            {rule.glob}
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      className="rules-editor-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(rule.name);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {showForm && (
            <div className="rules-editor-form">
              <div className="rules-editor-form-header">
                <h3>{editing ? `Edit: ${editing}` : "New Rule"}</h3>
              </div>
              <div className="rules-form-group">
                <label className="rules-form-label">Name</label>
                <input
                  className="rules-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="rule-name"
                  disabled={!!editing}
                />
              </div>
              <div className="rules-form-group">
                <label className="rules-form-label">Type</label>
                <select
                  className="rules-form-select"
                  value={formType}
                  onChange={(e) =>
                    setFormType(e.target.value as RuleMeta["type"])
                  }
                >
                  <option value="always_on">Always On</option>
                  <option value="model_decision">Model Decision</option>
                  <option value="glob">Glob</option>
                </select>
              </div>
              {formType === "glob" && (
                <div className="rules-form-group">
                  <label className="rules-form-label">Glob Pattern</label>
                  <input
                    className="rules-form-input"
                    value={formGlob}
                    onChange={(e) => setFormGlob(e.target.value)}
                    placeholder="*.ts, *.tsx"
                  />
                </div>
              )}
              <div className="rules-form-group">
                <label className="rules-form-label">Description</label>
                <input
                  className="rules-form-input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div className="rules-form-group">
                <label className="rules-form-label">Priority</label>
                <input
                  className="rules-form-input"
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                />
              </div>
              <div className="rules-form-group">
                <label className="rules-form-label">Content (Markdown)</label>
                <textarea
                  className="rules-form-textarea"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Rule instructions..."
                  rows={12}
                />
              </div>
              <div className="rules-form-actions">
                <button
                  className="rules-editor-btn rules-editor-btn--primary"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving || !formName.trim()}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="rules-editor-btn" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {deleteConfirm && (
          <div className="rules-editor-overlay rules-delete-overlay">
            <div className="rules-delete-dialog">
              <p>{`Delete rule "${deleteConfirm}"?`}</p>
              <div className="rules-delete-actions">
                <button
                  className="rules-editor-btn rules-editor-btn--danger"
                  onClick={() => {
                    void handleDelete(deleteConfirm);
                  }}
                >
                  Delete
                </button>
                <button
                  className="rules-editor-btn"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
