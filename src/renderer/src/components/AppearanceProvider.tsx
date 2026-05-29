import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_APPEARANCE,
  type ThemeMode,
  type ColorTheme,
  type FontScale,
  type UiFont,
  type AgentFont,
  THEME_STORAGE_KEY,
  COLOR_THEME_STORAGE_KEY,
  FONT_SCALE_STORAGE_KEY,
  UI_FONT_STORAGE_KEY,
  AGENT_FONT_STORAGE_KEY,
  readStoredAppearance,
  applyAppearanceToDocument,
  isThemeMode,
  isColorTheme,
  isFontScale,
  isUiFont,
  isAgentFont,
} from "../../../shared/appearance";

type ResolvedTheme = "light" | "dark";

interface AppearanceContextValue {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  colorTheme: ColorTheme;
  fontScale: FontScale;
  uiFont: UiFont;
  agentFont: AgentFont;
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setFontScale: (fontScale: FontScale) => void;
  setUiFont: (uiFont: UiFont) => void;
  setAgentFont: (agentFont: AgentFont) => void;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveThemeMode(theme: ThemeMode): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const stored = readStoredAppearance();
  const [theme, setThemeState] = useState<ThemeMode>(stored.theme);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(
    stored.colorTheme,
  );
  const [fontScale, setFontScaleState] = useState<FontScale>(stored.fontScale);
  const [uiFont, setUiFontState] = useState<UiFont>(stored.uiFont);
  const [agentFont, setAgentFontState] = useState<AgentFont>(stored.agentFont);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveThemeMode(stored.theme),
  );

  function setTheme(next: ThemeMode): void {
    if (!isThemeMode(next)) return;
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function setColorTheme(next: ColorTheme): void {
    if (!isColorTheme(next)) return;
    setColorThemeState(next);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, next);
  }

  function setFontScale(next: FontScale): void {
    if (!isFontScale(next)) return;
    setFontScaleState(next);
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, next);
  }

  function setUiFont(next: UiFont): void {
    if (!isUiFont(next)) return;
    setUiFontState(next);
    localStorage.setItem(UI_FONT_STORAGE_KEY, next);
  }

  function setAgentFont(next: AgentFont): void {
    if (!isAgentFont(next)) return;
    setAgentFontState(next);
    localStorage.setItem(AGENT_FONT_STORAGE_KEY, next);
  }

  function resetAppearance(): void {
    setThemeState(DEFAULT_APPEARANCE.theme);
    setColorThemeState(DEFAULT_APPEARANCE.colorTheme);
    setFontScaleState(DEFAULT_APPEARANCE.fontScale);
    setUiFontState(DEFAULT_APPEARANCE.uiFont);
    setAgentFontState(DEFAULT_APPEARANCE.agentFont);
    localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_APPEARANCE.theme);
    localStorage.setItem(
      COLOR_THEME_STORAGE_KEY,
      DEFAULT_APPEARANCE.colorTheme,
    );
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, DEFAULT_APPEARANCE.fontScale);
    localStorage.setItem(UI_FONT_STORAGE_KEY, DEFAULT_APPEARANCE.uiFont);
    localStorage.setItem(AGENT_FONT_STORAGE_KEY, DEFAULT_APPEARANCE.agentFont);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(): void {
      if (theme === "system") {
        setResolved(getSystemTheme());
      }
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    setResolved(resolveThemeMode(theme));
  }, [theme]);

  useEffect(() => {
    applyAppearanceToDocument(resolved, {
      theme,
      colorTheme,
      fontScale,
      uiFont,
      agentFont,
    });
  }, [resolved, theme, colorTheme, fontScale, uiFont, agentFont]);

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        resolved,
        colorTheme,
        fontScale,
        uiFont,
        agentFont,
        setTheme,
        setColorTheme,
        setFontScale,
        setUiFont,
        setAgentFont,
        resetAppearance,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}

/** Backward-compatible theme hook (light / dark / system). */
export function useTheme(): {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
} {
  const { theme, resolved, setTheme } = useAppearance();
  return { theme, resolved, setTheme };
}
