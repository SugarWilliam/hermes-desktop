/** Light / dark / system — unchanged from original theme picker. */
export type ThemeMode = "light" | "dark" | "system";

/** Color palette layered on top of resolved light/dark. */
export type ColorTheme = "default" | "midnight" | "ocean" | "warm" | "contrast";

export type FontScale = "sm" | "md" | "lg" | "xl";

export type UiFont = "google-sans" | "system" | "serif" | "mono";

export type AgentFont = "courier" | "consolas" | "system-mono" | "google-sans";

export const THEME_STORAGE_KEY = "hermes-theme";
export const COLOR_THEME_STORAGE_KEY = "hermes-color-theme";
export const FONT_SCALE_STORAGE_KEY = "hermes-font-scale";
export const UI_FONT_STORAGE_KEY = "hermes-ui-font";
export const AGENT_FONT_STORAGE_KEY = "hermes-agent-font";

/**
 * Han-script fallbacks when the primary Latin/UI font has no glyph.
 * Windows: 微软雅黑 / 黑体; macOS/Linux: PingFang / Noto as backup.
 */
export const CJK_FONT_FALLBACK =
  '"Microsoft YaHei", "微软雅黑", SimHei, "黑体", "PingFang SC", "Heiti SC", "Noto Sans CJK SC"';

function withCjkFallback(
  stack: string,
  generic: "sans-serif" | "monospace" | "serif",
): string {
  if (stack.includes("Microsoft YaHei")) return stack;
  return `${stack}, ${CJK_FONT_FALLBACK}, ${generic}`;
}

export const COLOR_THEME_OPTIONS: ReadonlyArray<{
  value: ColorTheme;
  labelKey: string;
}> = [
  { value: "default", labelKey: "settings.colorTheme.default" },
  { value: "midnight", labelKey: "settings.colorTheme.midnight" },
  { value: "ocean", labelKey: "settings.colorTheme.ocean" },
  { value: "warm", labelKey: "settings.colorTheme.warm" },
  { value: "contrast", labelKey: "settings.colorTheme.contrast" },
];

export const FONT_SCALE_OPTIONS: ReadonlyArray<{
  value: FontScale;
  labelKey: string;
  factor: number;
}> = [
  { value: "sm", labelKey: "settings.fontScale.sm", factor: 0.875 },
  { value: "md", labelKey: "settings.fontScale.md", factor: 1 },
  { value: "lg", labelKey: "settings.fontScale.lg", factor: 1.125 },
  { value: "xl", labelKey: "settings.fontScale.xl", factor: 1.25 },
];

export const UI_FONT_OPTIONS: ReadonlyArray<{
  value: UiFont;
  labelKey: string;
}> = [
  { value: "google-sans", labelKey: "settings.uiFont.googleSans" },
  { value: "system", labelKey: "settings.uiFont.system" },
  { value: "serif", labelKey: "settings.uiFont.serif" },
  { value: "mono", labelKey: "settings.uiFont.mono" },
];

export const AGENT_FONT_OPTIONS: ReadonlyArray<{
  value: AgentFont;
  labelKey: string;
}> = [
  { value: "courier", labelKey: "settings.agentFont.courier" },
  { value: "consolas", labelKey: "settings.agentFont.consolas" },
  { value: "system-mono", labelKey: "settings.agentFont.systemMono" },
  { value: "google-sans", labelKey: "settings.agentFont.googleSans" },
];

const UI_FONT_STACKS: Record<UiFont, string> = {
  "google-sans": withCjkFallback(
    '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    "sans-serif",
  ),
  system: withCjkFallback(
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    "sans-serif",
  ),
  serif: withCjkFallback(
    'Georgia, "Times New Roman", "Songti SC", serif',
    "serif",
  ),
  mono: withCjkFallback('"Courier New", Consolas', "monospace"),
};

const AGENT_FONT_STACKS: Record<AgentFont, string> = {
  courier: withCjkFallback('"Courier New", Consolas', "monospace"),
  consolas: withCjkFallback('Consolas, "Courier New"', "monospace"),
  "system-mono": withCjkFallback(
    'ui-monospace, "Cascadia Code", Consolas',
    "monospace",
  ),
  "google-sans": withCjkFallback(
    '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    "sans-serif",
  ),
};

export function isThemeMode(v: string): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

export function isColorTheme(v: string): v is ColorTheme {
  return (
    v === "default" ||
    v === "midnight" ||
    v === "ocean" ||
    v === "warm" ||
    v === "contrast"
  );
}

export function isFontScale(v: string): v is FontScale {
  return v === "sm" || v === "md" || v === "lg" || v === "xl";
}

export function isUiFont(v: string): v is UiFont {
  return (
    v === "google-sans" ||
    v === "system" ||
    v === "serif" ||
    v === "mono"
  );
}

export function isAgentFont(v: string): v is AgentFont {
  return (
    v === "courier" ||
    v === "consolas" ||
    v === "system-mono" ||
    v === "google-sans"
  );
}

export function fontScaleFactor(scale: FontScale): number {
  return FONT_SCALE_OPTIONS.find((o) => o.value === scale)?.factor ?? 1;
}

export function uiFontStack(font: UiFont): string {
  return UI_FONT_STACKS[font];
}

export function agentFontStack(font: AgentFont): string {
  return AGENT_FONT_STACKS[font];
}

export interface AppearanceSnapshot {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  fontScale: FontScale;
  uiFont: UiFont;
  agentFont: AgentFont;
}

export const DEFAULT_APPEARANCE: AppearanceSnapshot = {
  theme: "system",
  colorTheme: "default",
  fontScale: "md",
  uiFont: "google-sans",
  agentFont: "courier",
};

export function readStoredAppearance(): AppearanceSnapshot {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  const colorTheme = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
  const fontScale = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
  const uiFont = localStorage.getItem(UI_FONT_STORAGE_KEY);
  const agentFont = localStorage.getItem(AGENT_FONT_STORAGE_KEY);

  return {
    theme: theme && isThemeMode(theme) ? theme : DEFAULT_APPEARANCE.theme,
    colorTheme:
      colorTheme && isColorTheme(colorTheme)
        ? colorTheme
        : DEFAULT_APPEARANCE.colorTheme,
    fontScale:
      fontScale && isFontScale(fontScale)
        ? fontScale
        : DEFAULT_APPEARANCE.fontScale,
    uiFont:
      uiFont && isUiFont(uiFont) ? uiFont : DEFAULT_APPEARANCE.uiFont,
    agentFont:
      agentFont && isAgentFont(agentFont)
        ? agentFont
        : DEFAULT_APPEARANCE.agentFont,
  };
}

export function applyAppearanceToDocument(
  resolved: "light" | "dark",
  appearance: AppearanceSnapshot,
): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-color-theme", appearance.colorTheme);

  const factor = fontScaleFactor(appearance.fontScale);
  const basePx = 14 * factor;
  root.style.setProperty("--font-scale", String(factor));
  root.style.setProperty("--font-size-base", `${basePx}px`);
  root.style.setProperty("--font-size-sm", `${12 * factor}px`);
  root.style.setProperty("--font-size-lg", `${16 * factor}px`);
  root.style.setProperty("--chat-font-size", `${basePx}px`);
  root.style.setProperty("--agent-font-size", `${basePx}px`);

  const sans = uiFontStack(appearance.uiFont);
  const agent = agentFontStack(appearance.agentFont);
  root.style.setProperty("--font-sans", sans);
  root.style.setProperty("--font-agent", agent);
  root.style.setProperty(
    "--font-mono",
    withCjkFallback('"Courier New", Consolas', "monospace"),
  );
}
