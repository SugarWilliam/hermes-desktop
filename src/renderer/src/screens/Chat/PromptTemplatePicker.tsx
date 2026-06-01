import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface PromptTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
  profile?: string;
}

export function PromptTemplatePicker({
  open,
  onClose,
  onSelect,
  profile,
}: PromptTemplatePickerProps): React.JSX.Element | null {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newContent, setNewContent] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadTemplates = useCallback(async () => {
    const list = await window.hermesAPI.listPromptTemplates(profile);
    setTemplates(list);
  }, [profile]);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setSearch("");
      setSelectedCategory(null);
      setShowCreate(false);
      setPreviewId(null);
    }
  }, [open, loadTemplates]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    let list = templates;
    if (selectedCategory) {
      list = list.filter((t) => t.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [templates, selectedCategory, search]);

  const previewTemplate = templates.find((t) => t.id === previewId) ?? null;

  async function handleCreate(): Promise<void> {
    if (!newName.trim() || !newContent.trim()) return;
    await window.hermesAPI.createPromptTemplate(
      { name: newName.trim(), category: newCategory.trim() || "general", content: newContent.trim() },
      profile,
    );
    setNewName("");
    setNewContent("");
    setShowCreate(false);
    loadTemplates();
  }

  async function handleDelete(id: string): Promise<void> {
    await window.hermesAPI.deletePromptTemplate(id, profile);
    loadTemplates();
    if (previewId === id) setPreviewId(null);
  }

  function handleUse(tpl: PromptTemplate): void {
    onSelect(tpl.content);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="prompt-template-picker" ref={panelRef}>
      <div className="prompt-template-header">
        <span className="prompt-template-title">{t("chat.templates.title")}</span>
        <button className="prompt-template-close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>

      <div className="prompt-template-toolbar">
        <input
          className="prompt-template-search"
          placeholder={t("chat.templates.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="prompt-template-add-btn"
          onClick={() => setShowCreate(!showCreate)}
          title={t("chat.templates.create")}
          type="button"
        >
          <Plus size={14} />
        </button>
      </div>

      {categories.length > 0 && (
        <div className="prompt-template-categories">
          <button
            className={`prompt-template-cat ${!selectedCategory ? "active" : ""}`}
            onClick={() => setSelectedCategory(null)}
            type="button"
          >
            {t("chat.templates.all")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`prompt-template-cat ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              type="button"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="prompt-template-create">
          <input
            className="prompt-template-input"
            placeholder={t("chat.templates.namePlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="prompt-template-input"
            placeholder={t("chat.templates.categoryPlaceholder")}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <textarea
            className="prompt-template-textarea"
            placeholder={t("chat.templates.contentPlaceholder")}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
          />
          <button className="btn-primary prompt-template-save" onClick={handleCreate} type="button">
            {t("chat.templates.save")}
          </button>
        </div>
      )}

      <div className="prompt-template-list">
        {filtered.length === 0 && (
          <div className="prompt-template-empty">{t("chat.templates.empty")}</div>
        )}
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className={`prompt-template-item ${previewId === tpl.id ? "active" : ""}`}
          >
            <div
              className="prompt-template-item-main"
              onClick={() => setPreviewId(previewId === tpl.id ? null : tpl.id)}
            >
              <FileText size={14} className="prompt-template-item-icon" />
              <div className="prompt-template-item-info">
                <span className="prompt-template-item-name">{tpl.name}</span>
                <span className="prompt-template-item-cat">{tpl.category}</span>
              </div>
            </div>
            <div className="prompt-template-item-actions">
              <button
                className="prompt-template-use-btn"
                onClick={() => handleUse(tpl)}
                type="button"
              >
                {t("chat.templates.use")}
              </button>
              <button
                className="prompt-template-del-btn"
                onClick={() => handleDelete(tpl.id)}
                type="button"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewTemplate && (
        <div className="prompt-template-preview">
          <div className="prompt-template-preview-title">{previewTemplate.name}</div>
          <pre className="prompt-template-preview-content">{previewTemplate.content}</pre>
        </div>
      )}
    </div>
  );
}
