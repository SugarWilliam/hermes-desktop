import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { profileHome } from "./utils";

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const TEMPLATES_DIR_NAME = "prompt-templates";

function templatesDir(profile?: string): string {
  const dir = join(profileHome(profile), TEMPLATES_DIR_NAME);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function templatePath(id: string, profile?: string): string {
  return join(templatesDir(profile), `${id}.json`);
}

function generateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listPromptTemplates(profile?: string): PromptTemplate[] {
  const dir = templatesDir(profile);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const templates: PromptTemplate[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      templates.push(JSON.parse(raw) as PromptTemplate);
    } catch {
      /* skip corrupt files */
    }
  }
  return templates.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPromptTemplate(
  id: string,
  profile?: string,
): PromptTemplate | null {
  const p = templatePath(id, profile);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as PromptTemplate;
  } catch {
    return null;
  }
}

export function createPromptTemplate(
  input: { name: string; category: string; content: string },
  profile?: string,
): PromptTemplate {
  const now = Date.now();
  const tpl: PromptTemplate = {
    id: generateId(),
    name: input.name,
    category: input.category || "general",
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(templatePath(tpl.id, profile), JSON.stringify(tpl, null, 2), "utf-8");
  return tpl;
}

export function updatePromptTemplate(
  id: string,
  updates: { name?: string; category?: string; content?: string },
  profile?: string,
): { success: boolean; error?: string; template?: PromptTemplate } {
  const existing = getPromptTemplate(id, profile);
  if (!existing) return { success: false, error: "Template not found" };
  const merged: PromptTemplate = {
    ...existing,
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.category !== undefined && { category: updates.category }),
    ...(updates.content !== undefined && { content: updates.content }),
    updatedAt: Date.now(),
  };
  writeFileSync(templatePath(id, profile), JSON.stringify(merged, null, 2), "utf-8");
  return { success: true, template: merged };
}

export function deletePromptTemplate(
  id: string,
  profile?: string,
): { success: boolean; error?: string } {
  const p = templatePath(id, profile);
  if (!existsSync(p)) return { success: false, error: "Template not found" };
  try {
    unlinkSync(p);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
