import {
  FileText,
  FileCode,
  FileJson,
  FileBraces,
  Globe,
  Image,
  Terminal,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceFileKind =
  | "typescript"
  | "tsx"
  | "javascript"
  | "json"
  | "markdown"
  | "html"
  | "css"
  | "python"
  | "shell"
  | "config"
  | "image"
  | "generic";

const EXT_MAP: Record<string, WorkspaceFileKind> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "config",
  yaml: "config",
  toml: "config",
  ini: "config",
  env: "config",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
};

const ICONS: Record<WorkspaceFileKind, LucideIcon> = {
  typescript: FileCode,
  tsx: FileCode,
  javascript: FileCode,
  json: FileJson,
  markdown: FileText,
  html: Globe,
  css: FileBraces,
  python: FileCode,
  shell: Terminal,
  config: Settings,
  image: Image,
  generic: FileText,
};

export function workspaceFileKind(name: string): WorkspaceFileKind {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "generic";
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_MAP[ext] ?? "generic";
}

export function workspaceFileIcon(name: string): LucideIcon {
  return ICONS[workspaceFileKind(name)];
}

export type WorkspaceGitBadge = "M" | "A" | "D" | "U";

export function gitStatusToBadge(
  status: "modified" | "added" | "deleted" | "untracked" | undefined,
): WorkspaceGitBadge | null {
  if (!status) return null;
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "U";
    default:
      return null;
  }
}
