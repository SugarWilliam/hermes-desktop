import { useState } from "react";
import { ArrowRight, ExternalLink, KeyRound } from "../../assets/icons";
import {
  canAttemptOAuthLogin,
  resolveOAuthProviderId,
} from "../../../../shared/providerLogin";
import { LOCAL_PRESETS, PROVIDERS, type SetupProviderDef } from "../../constants";
import { useI18n } from "../../components/useI18n";
import VerifyWarningBanner from "../../components/VerifyWarningBanner";
import BrandLogo from "../../components/common/BrandLogo";
import OAuthLoginModal from "../../components/OAuthLoginModal";

interface SetupProps {
  onComplete: () => void;
  verifyWarning?: boolean;
  onReinstall?: () => void;
  onDismissVerifyWarning?: () => void;
}

function Setup({
  onComplete,
  verifyWarning,
  onReinstall,
  onDismissVerifyWarning,
}: SetupProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const isChinaLocale =
    locale === "zh-CN" || locale === "zh-TW" || locale.startsWith("zh");
  const [selectedProvider, setSelectedProvider] = useState(
    isChinaLocale ? "deepseek" : "openrouter",
  );
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [modelName, setModelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [oauthModal, setOauthModal] = useState<SetupProviderDef | null>(null);
  const [oauthSignedIn, setOauthSignedIn] = useState<Record<string, boolean>>(
    {},
  );

  const provider = PROVIDERS.setup.find((p) => p.id === selectedProvider)!;
  const isLocal = selectedProvider === "local";
  function applyLocalPreset(presetBaseUrl: string): void {
    setBaseUrl(presetBaseUrl);
  }

  function resolveCustomEnvKey(url: string): string {
    const preset = LOCAL_PRESETS.find((p) => p.baseUrl === url);
    if (preset?.envKey) return preset.envKey;
    if (/openrouter\.ai/i.test(url)) return "OPENROUTER_API_KEY";
    if (/anthropic\.com/i.test(url)) return "ANTHROPIC_API_KEY";
    if (/openai\.com/i.test(url)) return "OPENAI_API_KEY";
    if (/huggingface\.co/i.test(url)) return "HF_TOKEN";
    if (/api\.groq\.com/i.test(url)) return "GROQ_API_KEY";
    if (/api\.deepseek\.com/i.test(url)) return "DEEPSEEK_API_KEY";
    if (/api\.together\.xyz/i.test(url)) return "TOGETHER_API_KEY";
    if (/api\.fireworks\.ai/i.test(url)) return "FIREWORKS_API_KEY";
    if (/api\.cerebras\.ai/i.test(url)) return "CEREBRAS_API_KEY";
    if (/api\.mistral\.ai/i.test(url)) return "MISTRAL_API_KEY";
    if (/api\.perplexity\.ai/i.test(url)) return "PERPLEXITY_API_KEY";
    if (/dashscope(-intl)?\.aliyuncs\.com/i.test(url)) return "QWEN_API_KEY";
    if (/api\.moonshot\.(ai|cn)/i.test(url)) return "KIMI_API_KEY";
    if (/api\.kimi\.com\/coding/i.test(url)) return "KIMI_CODING_API_KEY";
    if (/opencode\.ai\/zen\/go/i.test(url)) return "OPENCODE_GO_API_KEY";
    if (/opencode\.ai\/zen/i.test(url)) return "OPENCODE_ZEN_API_KEY";
    return "CUSTOM_API_KEY";
  }

  async function persistConfig(): Promise<void> {
    if (provider.needsKey && provider.envKey && apiKey.trim()) {
      await window.hermesAPI.setEnv(provider.envKey, apiKey.trim());
    } else if (
      provider.authType === "api_key_or_oauth" &&
      provider.envKey &&
      apiKey.trim()
    ) {
      await window.hermesAPI.setEnv(provider.envKey, apiKey.trim());
    } else if (isLocal && apiKey.trim()) {
      const envKey = resolveCustomEnvKey(baseUrl.trim());
      await window.hermesAPI.setEnv(envKey, apiKey.trim());
    }

    const configProvider = isLocal ? "custom" : provider.configProvider;
    const configBaseUrl = isLocal ? baseUrl.trim() : provider.baseUrl;
    const configModel = modelName.trim() || provider.defaultModel || "";
    await window.hermesAPI.setModelConfig(
      configProvider,
      configModel,
      configBaseUrl,
    );
  }

  async function handleContinue(): Promise<void> {
    // Setup grid uses optional key + OAuth for cloud providers; no hard-required API key.
    const keyRequired = false;
    const oauthOnly =
      provider.authType === "oauth" && !oauthSignedIn[provider.id];
    if (keyRequired || oauthOnly) {
      setError(
        oauthOnly ? t("setup.missingOAuth") : t("setup.missingApiKey"),
      );
      return;
    }
    if (isLocal && !baseUrl.trim()) {
      setError(t("setup.missingServerUrl"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      await persistConfig();
      onComplete();
    } catch {
      setError(t("setup.saveFailed"));
      setSaving(false);
    }
  }

  function openOAuthLogin(): void {
    if (!canAttemptOAuthLogin(provider.id)) return;
    setOauthModal(provider);
  }

  return (
    <div className="screen setup-screen">
      {verifyWarning && onReinstall && onDismissVerifyWarning && (
        <VerifyWarningBanner
          onReinstall={onReinstall}
          onDismiss={onDismissVerifyWarning}
        />
      )}
      <h1 className="setup-title">{t("setup.title")}</h1>
      <p className="setup-subtitle">{t("setup.subtitle")}</p>

      <div className="setup-provider-grid">
        {PROVIDERS.setup.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`setup-provider-card ${selectedProvider === p.id ? "selected" : ""}`}
            onClick={() => {
              setSelectedProvider(p.id);
              setError("");
            }}
          >
            <BrandLogo provider={p.id} size={24} matchTheme={true} />
            <div className="setup-provider-name">{t(p.name)}</div>
            {p.tag && <div className="setup-provider-tag">{t(p.tag)}</div>}
          </button>
        ))}
      </div>

      <div className="setup-form">
        {isLocal ? (
          <>
            <label className="setup-label">{t("setup.localGroupLabel")}</label>
            <div className="setup-local-presets">
              {LOCAL_PRESETS.filter((p) => p.group === "local").map(
                (preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`setup-local-preset ${baseUrl === preset.baseUrl ? "active" : ""}`}
                    onClick={() => applyLocalPreset(preset.baseUrl)}
                  >
                    {t(`setup.localPresets.${preset.id}`)}
                  </button>
                ),
              )}
            </div>

            <label className="setup-label" style={{ marginTop: 12 }}>
              {t("setup.remoteGroupLabel")}
            </label>
            <div className="setup-local-presets">
              {LOCAL_PRESETS.filter((p) => p.group === "remote").map(
                (preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`setup-local-preset ${baseUrl === preset.baseUrl ? "active" : ""}`}
                    onClick={() => applyLocalPreset(preset.baseUrl)}
                  >
                    {t(`setup.localPresets.${preset.id}`)}
                  </button>
                ),
              )}
            </div>

            <label className="setup-label" style={{ marginTop: 16 }}>
              {t("setup.serverUrl")}
            </label>
            <input
              className="input"
              type="text"
              placeholder={t("setup.modelBaseUrlPlaceholder")}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setError("");
              }}
              autoFocus
            />
            <div className="setup-field-hint">
              {t("setup.customServerHint")}
            </div>

            <label className="setup-label" style={{ marginTop: 16 }}>
              {t("setup.customApiKeyLabel")}{" "}
              <span className="setup-label-optional">
                {t("common.optional")}
              </span>
            </label>
            <div className="setup-input-group">
              <input
                className="input"
                type={showKey ? "text" : "password"}
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
              />
              <button
                className="setup-toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? t("common.hide") : t("common.show")}
              </button>
            </div>
            <div className="setup-field-hint">
              {t("setup.customApiKeyHint")}
            </div>

            <label className="setup-label" style={{ marginTop: 16 }}>
              {t("setup.modelName")}{" "}
              <span className="setup-label-optional">
                {t("common.optional")}
              </span>
            </label>
            <input
              className="input"
              type="text"
              placeholder={t("setup.modelNamePlaceholder")}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
            <div className="setup-field-hint">
              {t("setup.defaultModelHint")}
            </div>
          </>
        ) : provider.authType === "api_key_or_oauth" ? (
          <>
            <div className="setup-field-hint">{t("setup.oauthOptionalKey")}</div>
            <label className="setup-label">{t("setup.oauthOptionalKey")}</label>
            <div className="setup-input-group">
              <input
                className="input"
                type={showKey ? "text" : "password"}
                placeholder={provider.placeholder}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && void handleContinue()}
              />
              <button
                className="setup-toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? t("common.hide") : t("common.show")}
              </button>
            </div>
            {provider.url && (
              <button
                type="button"
                className="setup-link"
                onClick={() => window.hermesAPI.openExternal(provider.url)}
              >
                {t("setup.noKeyHint")}
                <ExternalLink size={12} />
              </button>
            )}
            {canAttemptOAuthLogin(provider.id) && (
              <button
                type="button"
                className="btn btn-secondary setup-oauth-btn"
                onClick={openOAuthLogin}
              >
                <KeyRound size={14} />
                {t("setup.oauthSignIn")} — {t(provider.name)}
              </button>
            )}
            {oauthSignedIn[provider.id] && (
              <div className="setup-oauth-ok">{t("providers.oauth.successHint")}</div>
            )}
            <label className="setup-label" style={{ marginTop: 16 }}>
              {t("setup.modelName")}{" "}
              <span className="setup-label-optional">
                {t("common.optional")}
              </span>
            </label>
            <input
              className="input"
              type="text"
              placeholder={t("setup.modelNamePlaceholder")}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleContinue()}
            />
            <div className="setup-field-hint">
              {t("setup.defaultModelHint")}
            </div>
          </>
        ) : provider.authType === "oauth" ? (
          <>
            <div className="setup-field-hint">{t("setup.oauthSignInHint")}</div>
            <button
              type="button"
              className="btn btn-secondary setup-oauth-btn"
              onClick={openOAuthLogin}
            >
              <KeyRound size={14} />
              {t("setup.oauthSignIn")} — {t(provider.name)}
            </button>
            {oauthSignedIn[provider.id] && (
              <div className="setup-oauth-ok">{t("providers.oauth.successHint")}</div>
            )}
            <label className="setup-label" style={{ marginTop: 16 }}>
              {t("setup.modelName")}{" "}
              <span className="setup-label-optional">
                {t("common.optional")}
              </span>
            </label>
            <input
              className="input"
              type="text"
              placeholder={t("setup.modelNamePlaceholder")}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleContinue()}
            />
            <div className="setup-field-hint">
              {t("setup.defaultModelHint")}
            </div>
          </>
        ) : null}

        {error && <div className="setup-error">{error}</div>}

        <button
          type="button"
          className="btn btn-primary setup-continue"
          onClick={() => void handleContinue()}
          disabled={
            saving ||
            (provider.authType === "oauth" && !oauthSignedIn[provider.id]) ||
            (isLocal && !baseUrl.trim())
          }
          style={{ marginTop: 20 }}
        >
          {saving ? t("setup.saving") : t("setup.continue")}
          {!saving && <ArrowRight size={16} />}
        </button>
      </div>

      {oauthModal && (
        <OAuthLoginModal
          provider={resolveOAuthProviderId(oauthModal.id)}
          providerLabel={t(oauthModal.name)}
          onSuccess={async (providerId) => {
            setOauthSignedIn((prev) => ({ ...prev, [providerId]: true }));
            const pdef = PROVIDERS.setup.find((s) => s.id === providerId);
            setOauthModal(null);
            if (!pdef) return;
            try {
              await window.hermesAPI.setModelConfig(
                pdef.configProvider,
                modelName.trim() || pdef.defaultModel || "",
                pdef.baseUrl,
              );
            } catch {
              /* user can still press Continue */
            }
          }}
          onClose={() => setOauthModal(null)}
        />
      )}
    </div>
  );
}

export default Setup;
