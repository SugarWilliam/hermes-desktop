import { useI18n } from "../../components/useI18n";
import { useAppearance } from "../../components/AppearanceProvider";
import { THEME_OPTIONS } from "../../constants";
import {
  COLOR_THEME_OPTIONS,
  FONT_SCALE_OPTIONS,
  UI_FONT_OPTIONS,
  AGENT_FONT_OPTIONS,
} from "../../../../shared/appearance";

function OptionButtons<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: ReadonlyArray<{ value: T; labelKey: string }>;
  value: T;
  onChange: (v: T) => void;
  labelFor: (opt: { value: T; labelKey: string }) => string;
}): React.JSX.Element {
  return (
    <div className="settings-theme-options settings-theme-options--wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`settings-theme-option ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {labelFor(opt)}
        </button>
      ))}
    </div>
  );
}

export function AppearanceSettings(): React.JSX.Element {
  const { t } = useI18n();
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    fontScale,
    setFontScale,
    uiFont,
    setUiFont,
    agentFont,
    setAgentFont,
    resetAppearance,
  } = useAppearance();

  return (
    <>
      <div className="settings-field">
        <label className="settings-field-label">
          {t("settings.theme.label")}
        </label>
        <div className="settings-theme-options settings-theme-options--wrap">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`settings-theme-option ${theme === opt.value ? "active" : ""}`}
              onClick={() => setTheme(opt.value)}
            >
              {opt.value === "system"
                ? t("settings.theme.system")
                : opt.value === "light"
                  ? t("settings.theme.light")
                  : t("settings.theme.dark")}
            </button>
          ))}
        </div>
        <div className="settings-field-hint">{t("settings.theme.hint")}</div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label">
          {t("settings.colorTheme.label")}
        </label>
        <OptionButtons
          options={COLOR_THEME_OPTIONS}
          value={colorTheme}
          onChange={setColorTheme}
          labelFor={(opt) => t(opt.labelKey)}
        />
        <div className="settings-field-hint">
          {t("settings.colorTheme.hint")}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label">
          {t("settings.fontScale.label")}
        </label>
        <OptionButtons
          options={FONT_SCALE_OPTIONS}
          value={fontScale}
          onChange={setFontScale}
          labelFor={(opt) => t(opt.labelKey)}
        />
        <div className="settings-field-hint">
          {t("settings.fontScale.hint")}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label">
          {t("settings.uiFont.label")}
        </label>
        <OptionButtons
          options={UI_FONT_OPTIONS}
          value={uiFont}
          onChange={setUiFont}
          labelFor={(opt) => t(opt.labelKey)}
        />
        <div className="settings-field-hint">{t("settings.uiFont.hint")}</div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label">
          {t("settings.agentFont.label")}
        </label>
        <OptionButtons
          options={AGENT_FONT_OPTIONS}
          value={agentFont}
          onChange={setAgentFont}
          labelFor={(opt) => t(opt.labelKey)}
        />
        <div className="settings-field-hint">{t("settings.agentFont.hint")}</div>
      </div>

      <div className="settings-field">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={resetAppearance}
        >
          {t("settings.appearanceReset")}
        </button>
        <div className="settings-field-hint">
          {t("settings.appearanceResetHint")}
        </div>
      </div>
    </>
  );
}
