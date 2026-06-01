import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── Types ──────────────────────────────────────────

export interface Keybinding {
  id: string;
  label: string;
  defaultKey: string;
  key: string;
}

// ── Default keybindings ────────────────────────────

const DEFAULT_KEYBINDINGS: Keybinding[] = [
  { id: "newChat", label: "New Chat", defaultKey: "CmdOrCtrl+N", key: "CmdOrCtrl+N" },
  { id: "clearChat", label: "Clear Chat", defaultKey: "CmdOrCtrl+Shift+C", key: "CmdOrCtrl+Shift+C" },
  { id: "toggleWorkspace", label: "Toggle Workspace", defaultKey: "CmdOrCtrl+B", key: "CmdOrCtrl+B" },
  { id: "focusInput", label: "Focus Input", defaultKey: "CmdOrCtrl+L", key: "CmdOrCtrl+L" },
  { id: "toggleFastMode", label: "Toggle Fast Mode", defaultKey: "CmdOrCtrl+Shift+F", key: "CmdOrCtrl+Shift+F" },
  { id: "goToSettings", label: "Go to Settings", defaultKey: "CmdOrCtrl+,", key: "CmdOrCtrl+," },
  { id: "goToSessions", label: "Go to Sessions", defaultKey: "CmdOrCtrl+Shift+H", key: "CmdOrCtrl+Shift+H" },
];

// ── File I/O ───────────────────────────────────────

function keybindingsPath(profile?: string): string {
  const base = profile
    ? join(homedir(), ".hermes", "profiles", profile)
    : join(homedir(), ".hermes");
  return join(base, "keybindings.json");
}

export function getKeybindings(profile?: string): Keybinding[] {
  const filePath = keybindingsPath(profile);
  try {
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, string>;
      return DEFAULT_KEYBINDINGS.map((kb) => ({
        ...kb,
        key: data[kb.id] || kb.defaultKey,
      }));
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_KEYBINDINGS.map((kb) => ({ ...kb }));
}

export function setKeybinding(
  id: string,
  key: string,
  profile?: string,
): Keybinding[] {
  const filePath = keybindingsPath(profile);
  const current = getKeybindings(profile);
  const updated = current.map((kb) =>
    kb.id === id ? { ...kb, key } : kb,
  );

  // Write as simple { id: key } map
  const map: Record<string, string> = {};
  for (const kb of updated) {
    if (kb.key !== kb.defaultKey) {
      map[kb.id] = kb.key;
    }
  }

  try {
    const dir = join(filePath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(map, null, 2), "utf-8");
  } catch {
    /* non-fatal */
  }

  return updated;
}

export function resetKeybinding(id: string, profile?: string): Keybinding[] {
  const kb = DEFAULT_KEYBINDINGS.find((k) => k.id === id);
  if (!kb) return getKeybindings(profile);
  return setKeybinding(id, kb.defaultKey, profile);
}
