import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { Plus, Trash2, Pencil, X, Check, Server } from "lucide-react";

interface McpServer {
  name: string;
  type: string;
  enabled: boolean;
  detail: string;
}

interface McpFormData {
  name: string;
  type: "stdio" | "http";
  command: string;
  args: string;
  url: string;
  env: string;
}

const EMPTY_FORM: McpFormData = {
  name: "",
  type: "stdio",
  command: "",
  args: "",
  url: "",
  env: "",
};

function McpManager({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<McpFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await window.hermesAPI.listMcpServers(profile);
      setServers(list);
    } catch {
      // non-fatal
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  function buildInput(): {
    name: string;
    type: "stdio" | "http";
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
  } {
    const input: ReturnType<typeof buildInput> = {
      name: form.name.trim(),
      type: form.type,
    };
    if (form.type === "http") {
      input.url = form.url.trim();
    } else {
      input.command = form.command.trim();
      if (form.args.trim()) {
        input.args = form.args
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      }
    }
    if (form.env.trim()) {
      const env: Record<string, string> = {};
      for (const line of form.env.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }
      if (Object.keys(env).length > 0) input.env = env;
    }
    return input;
  }

  async function handleSave(): Promise<void> {
    setError(null);
    const input = buildInput();
    if (!input.name) {
      setError(t("settings.mcp.nameRequired"));
      return;
    }
    let result: { success: boolean; error?: string };
    if (editingName) {
      result = await window.hermesAPI.updateMcpServer(editingName, input, profile);
    } else {
      result = await window.hermesAPI.addMcpServer(input, profile);
    }
    if (result.success) {
      setShowForm(false);
      setEditingName(null);
      setForm(EMPTY_FORM);
      await loadServers();
    } else {
      setError(result.error || "Failed");
    }
  }

  async function handleDelete(name: string): Promise<void> {
    const result = await window.hermesAPI.removeMcpServer(name, profile);
    if (result.success) {
      await loadServers();
    }
  }

  function handleEdit(server: McpServer): void {
    setEditingName(server.name);
    setForm({
      name: server.name,
      type: server.type as "stdio" | "http",
      command: "",
      args: "",
      url: server.detail || "",
      env: "",
    });
    setShowForm(true);
    setError(null);
  }

  return (
    <div className="mcp-manager">
      {/* Server list */}
      {loading ? (
        <div className="usage-loading">
          <span className="skeleton skeleton-md" />
        </div>
      ) : servers.length === 0 ? (
        <div className="usage-empty">{t("settings.mcp.empty")}</div>
      ) : (
        <div className="mcp-server-list">
          {servers.map((srv) => (
            <div key={srv.name} className="mcp-server-item">
              <div className="mcp-server-info">
                <Server size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                <div className="mcp-server-detail">
                  <span className="mcp-server-name">{srv.name}</span>
                  <span className="mcp-server-meta">
                    {srv.type} · {srv.detail}
                    {!srv.enabled && (
                      <span className="mcp-disabled"> · disabled</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="mcp-server-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleEdit(srv)}
                  title={t("settings.mcp.edit")}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleDelete(srv.name)}
                  title={t("settings.mcp.delete")}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <button
          className="btn btn-secondary mcp-add-btn"
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditingName(null);
            setShowForm(true);
            setError(null);
          }}
        >
          <Plus size={14} style={{ marginRight: 4 }} />
          {t("settings.mcp.add")}
        </button>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="mcp-form">
          <div className="mcp-form-header">
            <span className="mcp-form-title">
              {editingName ? t("settings.mcp.edit") : t("settings.mcp.add")}
            </span>
            <button
              className="btn-ghost"
              onClick={() => {
                setShowForm(false);
                setEditingName(null);
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="settings-field">
            <label className="settings-field-label">{t("settings.mcp.nameLabel")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-server"
              disabled={!!editingName}
            />
          </div>

          <div className="settings-field">
            <label className="settings-field-label">{t("settings.mcp.typeLabel")}</label>
            <div className="settings-theme-options">
              <button
                className={`settings-theme-option ${form.type === "stdio" ? "active" : ""}`}
                onClick={() => setForm({ ...form, type: "stdio" })}
              >
                stdio
              </button>
              <button
                className={`settings-theme-option ${form.type === "http" ? "active" : ""}`}
                onClick={() => setForm({ ...form, type: "http" })}
              >
                HTTP
              </button>
            </div>
          </div>

          {form.type === "stdio" ? (
            <>
              <div className="settings-field">
                <label className="settings-field-label">{t("settings.mcp.commandLabel")}</label>
                <input
                  className="input"
                  value={form.command}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="npx"
                />
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.mcp.argsLabel")}
                  <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>
                    ({t("settings.mcp.argsHint")})
                  </span>
                </label>
                <textarea
                  className="input mcp-textarea"
                  value={form.args}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                  placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="settings-field">
              <label className="settings-field-label">{t("settings.mcp.urlLabel")}</label>
              <input
                className="input"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="http://localhost:3001"
              />
            </div>
          )}

          <div className="settings-field">
            <label className="settings-field-label">
              {t("settings.mcp.envLabel")}
              <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>
                ({t("settings.mcp.envHint")})
              </span>
            </label>
            <textarea
              className="input mcp-textarea"
              value={form.env}
              onChange={(e) => setForm({ ...form, env: e.target.value })}
              placeholder={"API_KEY=sk-xxx\nDEBUG=true"}
              rows={2}
            />
          </div>

          {error && <div className="mcp-error">{error}</div>}

          <div className="mcp-form-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={14} style={{ marginRight: 4 }} />
              {t("settings.save")}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditingName(null);
              }}
            >
              {t("settings.mcp.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default McpManager;
