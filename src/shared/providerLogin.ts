/**
 * Provider sign-in helpers — desktop resolves OAuth targets without a
 * hard-coded allowlist. Copilot uses a dedicated Python path; everything
 * else goes through `hermes auth add <id> --type oauth` when available.
 */

/** Env keys that map to a different OAuth provider id than the key prefix. */
export const ENV_KEY_OAUTH_PROVIDER: Record<string, string> = {
  OPENAI_API_KEY: "openai-codex",
  GOOGLE_API_KEY: "google-gemini-cli",
  XAI_API_KEY: "xai-oauth",
  NOUS_API_KEY: "nous",
  MINIMAX_API_KEY: "minimax-oauth",
  MINIMAX_CN_API_KEY: "minimax-oauth",
  HF_TOKEN: "huggingface",
};

/** UI / config provider ids that map to OAuth CLI ids. */
export const PROVIDER_OAUTH_ALIASES: Record<string, string> = {
  openai: "openai-codex",
  google: "google-gemini-cli",
  xai: "xai-oauth",
  qwen: "qwen-oauth",
  minimax: "minimax-oauth",
  kimi: "kimi-coding",
  "kimi-coding": "kimi-coding",
};

const SKIP_OAUTH = new Set(["auto", "local", ""]);

/**
 * Resolve the provider id passed to `hermes auth add <id> --type oauth`
 * (or the Copilot Python login) from an env key, setup id, or picker value.
 */
export function resolveOAuthProviderId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (ENV_KEY_OAUTH_PROVIDER[trimmed]) {
    return ENV_KEY_OAUTH_PROVIDER[trimmed];
  }
  const alias = PROVIDER_OAUTH_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const fromEnv = trimmed.match(/^([A-Z0-9_]+)_API_KEY$/);
  if (fromEnv) {
    const key = fromEnv[1];
    if (ENV_KEY_OAUTH_PROVIDER[`${key}_API_KEY`]) {
      return ENV_KEY_OAUTH_PROVIDER[`${key}_API_KEY`];
    }
    return key.toLowerCase().replace(/_/g, "-");
  }
  if (trimmed === "HF_TOKEN") return "huggingface";
  return trimmed;
}

/** Whether the UI should offer an OAuth / browser sign-in button. */
export function canAttemptOAuthLogin(providerOrEnvKey: string): boolean {
  const id = resolveOAuthProviderId(providerOrEnvKey).toLowerCase();
  if (SKIP_OAUTH.has(id)) return false;
  if (id === "custom") return false;
  return true;
}

/** @deprecated Use resolveOAuthProviderId — kept for imports during migration. */
export const OAUTH_LOGIN_PROVIDER_IDS = [
  "openai-codex",
  "copilot",
  "xai-oauth",
  "qwen-oauth",
  "google-gemini-cli",
  "minimax-oauth",
  "nous",
  "kimi-coding",
] as const;
