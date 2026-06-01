#!/usr/bin/env node
/**
 * Copy monaco-editor/min/vs into renderer public/ so the AMD loader can
 * fetch scripts from 'self' (CSP blocks the default jsDelivr CDN).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/monaco-editor/min/vs");
const destDir = join(root, "src/renderer/public/monaco");
const dest = join(destDir, "vs");

if (!existsSync(src)) {
  console.error(
    "[sync-monaco] monaco-editor not found — run: npm install monaco-editor",
  );
  process.exit(1);
}

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-monaco] copied ${src} -> ${dest}`);
