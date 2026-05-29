/**
 * Curated GitHub Copilot model IDs — mirrored from hermes-agent
 * `hermes_cli/models.py` `_PROVIDER_MODELS["copilot"]`.
 * Live account-specific lists come from `provider_model_ids("copilot")`;
 * these are seeded into `models.json` and used as OAuth discovery fallback.
 */
export const COPILOT_MODEL_IDS: readonly string[] = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-4.1",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-sonnet-4.6",
  "claude-sonnet-4",
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
] as const;

export function copilotDefaultModels(): Array<{
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
}> {
  return COPILOT_MODEL_IDS.map((model) => ({
    name: `Copilot · ${model}`,
    provider: "copilot",
    model,
    baseUrl: "",
  }));
}
