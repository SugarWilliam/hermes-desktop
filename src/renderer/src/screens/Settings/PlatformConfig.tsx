import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { PLATFORM_SCHEMAS, PLATFORM_LIST } from "../../../../shared/platformSchemas";

function PlatformConfig({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [platformStates, setPlatformStates] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string>(PLATFORM_LIST[0]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const loadPlatformStates = useCallback(async (): Promise<void> => {
    const states = await window.hermesAPI.getPlatformEnabled(profile);
    setPlatformStates(states);
  }, [profile]);

  const loadConfig = useCallback(async (platform: string): Promise<void> => {
    const cfg = await window.hermesAPI.getPlatformConfig(platform, profile);
    setConfig(cfg);
    setEdits(cfg);
  }, [profile]);

  useEffect(() => {
    void loadPlatformStates();
  }, [loadPlatformStates]);

  useEffect(() => {
    void loadConfig(selected);
  }, [selected, loadConfig]);

  async function handleSave(): Promise<void> {
    for (const [key, value] of Object.entries(edits)) {
      if (value !== config[key]) {
        await window.hermesAPI.setPlatformConfigValue(selected, key, value, profile);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await loadConfig(selected);
    await loadPlatformStates();
  }

  const schema = PLATFORM_SCHEMAS[selected];
  const isActive = platformStates[selected] ?? false;

  return (
    <div className="platform-config">
      {/* Platform selector */}
      <div className="platform-tabs">
        {PLATFORM_LIST.map((p) => (
          <button
            key={p}
            className={`platform-tab ${selected === p ? "active" : ""}`}
            onClick={() => setSelected(p)}
          >
            <span className={`platform-dot ${platformStates[p] ? "active" : ""}`} />
            {PLATFORM_SCHEMAS[p]?.name || p}
          </button>
        ))}
      </div>

      {/* Config form */}
      {schema && (
        <div className="platform-config-form">
          <div className="platform-status">
            <span className={`platform-status-badge ${isActive ? "active" : "inactive"}`}>
              {isActive ? t("settings.platform.active") : t("settings.platform.inactive")}
            </span>
            {!isActive && (
              <span className="platform-status-hint">
                {t("settings.platform.envHint")}{" "}
                <code>{schema.envVarHints.join(", ")}</code>
              </span>
            )}
          </div>

          {schema.fields.map((field) => (
            <div key={field.key} className="settings-field">
              <label className="settings-field-label">
                {field.label}
                {field.hint && (
                  <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>
                    ({field.hint})
                  </span>
                )}
              </label>
              <input
                className="input"
                type={field.type}
                value={edits[field.key] || ""}
                onChange={(e) =>
                  setEdits({ ...edits, [field.key]: e.target.value })
                }
                placeholder={field.placeholder}
              />
            </div>
          ))}

          {/* Show raw config keys not in schema */}
          {Object.keys(edits)
            .filter((k) => !schema.fields.some((f) => f.key === k) && k !== "enabled")
            .map((key) => (
              <div key={key} className="settings-field">
                <label className="settings-field-label">
                  <code>{key}</code>
                </label>
                <input
                  className="input"
                  value={edits[key] || ""}
                  onChange={(e) =>
                    setEdits({ ...edits, [key]: e.target.value })
                  }
                />
              </div>
            ))}

          <div className="mcp-form-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              {t("settings.save")}
            </button>
            {saved && (
              <span className="settings-saved" style={{ marginLeft: 8 }}>
                {t("settings.saved")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformConfig;
