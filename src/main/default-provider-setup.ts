import { getModelConfig, setModelConfig } from "./config";
import { getAppLocale } from "./locale";
import { resolveDefaultActiveModel } from "./default-models";

/**
 * Apply the bundled default active model when the profile has no model
 * selected yet (fresh install or empty config.yaml).
 *
 * Locale: zh-CN / zh-TW → DeepSeek; other locales → OpenRouter free tier.
 */
export function ensureDefaultActiveModel(
  profile?: string,
  locale?: string,
): boolean {
  const mc = getModelConfig(profile);
  const needsDefault =
    !mc.model?.trim() || mc.provider === "auto" || !mc.provider?.trim();
  if (!needsDefault) return false;

  const loc = locale ?? getAppLocale();
  const d = resolveDefaultActiveModel(loc);
  setModelConfig(d.provider, d.model, d.baseUrl, profile);
  return true;
}
