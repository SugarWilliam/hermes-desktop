import type { CSSProperties } from "react";

/** Props that prevent one-dark inline backgrounds (per-line “shadow” strips). */
export const PRISM_BLOCK_STYLE: Record<string, CSSProperties> = {};

export function prismCodeTagProps(language: string): {
  className: string;
  style: CSSProperties;
} {
  const lang = language || "text";
  return {
    className: `language-${lang}`,
    style: {
      background: "transparent",
      backgroundColor: "transparent",
      textShadow: "none",
      boxShadow: "none",
      whiteSpace: "pre",
    },
  };
}

export const PRISM_BLOCK_OPTIONS = {
  useInlineStyles: false as const,
  showLineNumbers: false as const,
  showInlineLineNumbers: false as const,
  wrapLines: false as const,
  wrapLongLines: false as const,
};
