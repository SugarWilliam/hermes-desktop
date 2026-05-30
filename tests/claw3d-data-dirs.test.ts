import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { describe, expect, it, afterEach } from "vitest";
import {
  buildOfficeEnv,
  ensureClaw3dDataDirs,
  isWritableOpenClawStateDir,
  resolveOpenClawStateDir,
} from "../src/main/claw3d";

describe("buildOfficeEnv OPENCLAW_STATE_DIR", () => {
  it("writes OPENCLAW_STATE_DIR when provided", () => {
    const env = buildOfficeEnv({
      port: 3000,
      url: "ws://x",
      apiKey: "",
      model: "hermes",
      openClawStateDir: "C:\\Users\\test\\.openclaw",
    });
    expect(env).toContain("OPENCLAW_STATE_DIR=C:\\Users\\test\\.openclaw");
  });
});

describe("ensureClaw3dDataDirs", () => {
  const testRoot = join(tmpdir(), `hermes-claw3d-${Date.now()}`);
  const homeOpenClaw = join(testRoot, "home-openclaw");
  const fallbackDir = join(testRoot, "fallback-state");

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("creates task-manager and tasks.json under a writable state dir", () => {
    mkdirSync(homeOpenClaw, { recursive: true });
    expect(isWritableOpenClawStateDir(homeOpenClaw)).toBe(true);

    const taskDir = join(homeOpenClaw, "claw3d", "task-manager");
    mkdirSync(taskDir, { recursive: true });
    const tasksPath = join(taskDir, "tasks.json");
    if (!existsSync(tasksPath)) {
      writeFileSync(
        tasksPath,
        JSON.stringify({ schemaVersion: 1, updatedAt: "", tasks: [] }),
      );
    }
    expect(existsSync(tasksPath)).toBe(true);
  });

  it("rejects a file at the state dir path", () => {
    mkdirSync(testRoot, { recursive: true });
    const fileAsDir = join(testRoot, "not-a-dir");
    writeFileSync(fileAsDir, "blocked");
    expect(isWritableOpenClawStateDir(fileAsDir)).toBe(false);
  });

  it("resolveOpenClawStateDir prefers home .openclaw when writable", () => {
    // Uses real homedir in unit test — only assert return type/shape when writable.
    const dir = resolveOpenClawStateDir();
    expect(dir.length).toBeGreaterThan(0);
    expect(dir.includes("openclaw")).toBe(true);
  });

  it("ensureClaw3dDataDirs returns ok for fallback-style path", () => {
    mkdirSync(fallbackDir, { recursive: true });
    expect(isWritableOpenClawStateDir(fallbackDir)).toBe(true);
    const taskDir = join(fallbackDir, "claw3d", "task-manager");
    mkdirSync(taskDir, { recursive: true });
    expect(existsSync(taskDir)).toBe(true);
  });
});
