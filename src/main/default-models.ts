/**
 * Default models seeded on first install.
 *
 * Contributors: add new models here! They'll be available to all users
 * on fresh install. Format:
 *   { name: "Display Name", provider: "provider-key", model: "model-id", baseUrl: "" }
 *
 * Provider keys must match hermes-agent's provider registry.
 */

import { copilotDefaultModels } from "./copilot-models";

export interface DefaultModel {
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
}

/** Overseas default (zh-* locales use {@link DEFAULT_ACTIVE_MODEL_CN}). */
export const DEFAULT_ACTIVE_MODEL: DefaultModel = {
  name: "OpenRouter · DeepSeek R1 (Free)",
  provider: "openrouter",
  model: "deepseek/deepseek-r1:free",
  baseUrl: "",
};

/** China / zh locale default — DeepSeek direct API. */
export const DEFAULT_ACTIVE_MODEL_CN: DefaultModel = {
  name: "DeepSeek Chat (国内默认)",
  provider: "deepseek",
  model: "deepseek-chat",
  baseUrl: "",
};

const CHINA_LOCALE_PREFIXES = ["zh"];

/** Pick active default from UI locale (zh-CN/zh-TW → DeepSeek, else OpenRouter free). */
export function resolveDefaultActiveModel(locale?: string): DefaultModel {
  const loc = (locale || "").trim().toLowerCase();
  if (CHINA_LOCALE_PREFIXES.some((p) => loc === p || loc.startsWith(`${p}-`))) {
    return DEFAULT_ACTIVE_MODEL_CN;
  }
  return DEFAULT_ACTIVE_MODEL;
}

const DEFAULT_MODELS: DefaultModel[] = [
  // ── Global free (OAuth — sign in via Providers → Nous Portal) ─────────
  DEFAULT_ACTIVE_MODEL,
  {
    name: "Nous · Owl Alpha (Free)",
    provider: "nous",
    model: "openrouter/owl-alpha",
    baseUrl: "",
  },

  // ── Global free / low-cost (API key) ─────────────────────────────────
  {
    name: "DeepSeek Chat",
    provider: "deepseek",
    model: "deepseek-chat",
    baseUrl: "",
  },
  {
    name: "OpenRouter · DeepSeek R1 (Free)",
    provider: "openrouter",
    model: "deepseek/deepseek-r1:free",
    baseUrl: "",
  },
  {
    name: "Groq · Llama 3.3 70B",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  {
    name: "OpenCode Go · DeepSeek V4 Flash",
    provider: "custom",
    model: "deepseek-v4-flash",
    baseUrl: "https://opencode.ai/zen/go/v1",
  },
  {
    name: "OpenCode Go · Kimi K2.6",
    provider: "custom",
    model: "kimi-k2.6",
    baseUrl: "https://opencode.ai/zen/go/v1",
  },

  // ── China-friendly (API key — use matching endpoint in Settings) ─────
  {
    name: "DeepSeek Chat (国内)",
    provider: "deepseek",
    model: "deepseek-chat",
    baseUrl: "",
  },
  {
    name: "通义 Qwen Turbo",
    provider: "qwen",
    model: "qwen-turbo",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    name: "通义 Qwen Turbo (国际)",
    provider: "qwen",
    model: "qwen-turbo",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  {
    name: "Kimi · Moonshot (开放平台)",
    provider: "custom",
    model: "kimi-k2.5",
    baseUrl: "https://api.moonshot.ai/v1",
  },
  {
    name: "Kimi · Moonshot (国内)",
    provider: "custom",
    model: "kimi-k2.5",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  {
    name: "Kimi Code · K2.6",
    provider: "custom",
    model: "kimi-k2.6",
    baseUrl: "https://api.kimi.com/coding/v1",
  },
  {
    name: "MiniMax M2 (全球)",
    provider: "minimax",
    model: "MiniMax-Text-01",
    baseUrl: "",
  },

  // ── GitHub Copilot (OAuth — Providers → GitHub Copilot) ─────────────
  ...copilotDefaultModels(),
];

export default DEFAULT_MODELS;
