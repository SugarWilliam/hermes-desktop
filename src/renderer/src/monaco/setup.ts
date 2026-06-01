/**
 * Load Monaco from same-origin static assets (public/monaco/vs).
 * Default @monaco-editor/loader CDN is blocked by renderer CSP (script-src 'self').
 */
import { loader } from "@monaco-editor/react";

function monacoVsPath(): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  const relative = `${normalized}monaco/vs`.replace(/\/{2,}/g, "/");
  if (import.meta.env.DEV) {
    return relative.replace(/\/$/, "");
  }
  return new URL("monaco/vs", window.location.href).href.replace(/\/$/, "");
}

const vsPath = monacoVsPath();

loader.config({
  paths: { vs: vsPath },
});

globalThis.MonacoEnvironment = {
  getWorkerUrl(_moduleId: string, _label: string): string {
    return `${vsPath}/base/worker/workerMain.js`;
  },
};
