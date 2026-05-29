import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

interface FakeProc extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
}

const { spawnSpy, fakeProcs, addCredentialPoolEntrySpy } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require("events");
  const fakeProcs: FakeProc[] = [];
  return {
    fakeProcs,
    spawnSpy: vi.fn(() => {
      const proc = new EE() as FakeProc;
      proc.stdout = new EE();
      proc.stderr = new EE();
      proc.kill = vi.fn();
      fakeProcs.push(proc);
      return proc;
    }),
    addCredentialPoolEntrySpy: vi.fn(),
  };
});

vi.mock("../src/main/installer", () => ({
  HERMES_PYTHON: "C:\\venv\\pythonw.exe",
  HERMES_REPO: "C:\\hermes\\hermes-agent",
  HERMES_HOME: "C:\\Users\\me\\.hermes",
  getEnhancedPath: () => process.env.PATH || "",
}));

vi.mock("../src/main/process-options", () => ({
  HIDDEN_SUBPROCESS_OPTIONS: {},
}));

vi.mock("../src/main/utils", () => ({
  stripAnsi: (s: string) => s,
}));

vi.mock("../src/main/config", () => ({
  addCredentialPoolEntry: addCredentialPoolEntrySpy,
}));

vi.mock("child_process", () => ({
  spawn: spawnSpy,
  default: { spawn: spawnSpy },
}));

import { runCopilotAuthLogin } from "../src/main/copilot-auth";

function lastProc(): FakeProc {
  return fakeProcs[fakeProcs.length - 1];
}

describe("runCopilotAuthLogin", () => {
  beforeEach(() => {
    spawnSpy.mockClear();
    fakeProcs.length = 0;
    addCredentialPoolEntrySpy.mockClear();
  });

  it("spawns python -c directly (not hermes_cli.main -c)", async () => {
    const promise = runCopilotAuthLogin(() => {});
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    const [exe, args] = spawnSpy.mock.calls[0] as [string, string[]];
    expect(exe).toBe("C:\\venv\\pythonw.exe");
    expect(args[0]).toBe("-c");
    expect(args[1]).toContain("copilot_device_code_login");
    expect(args[1]).not.toContain("hermes_cli.main");
    lastProc().emit("close", 1, null);
    await promise;
  });

  it("does not treat Hermes session errors mentioning the script as success", async () => {
    const promise = runCopilotAuthLogin(() => {});
    const proc = lastProc();
    const sessionErr = [
      "No session found matching '",
      "from hermes_cli.copilot_auth import copilot_device_code_login",
      "print(\"__HERMES_COPILOT_TOKEN__\" + token, flush=True)",
      "'. Use 'hermes sessions list' to see available sessions.",
    ].join("\n");
    proc.stderr.emit("data", Buffer.from(sessionErr + "\n"));
    proc.emit("close", 1, null);
    const result = await promise;
    expect(result.success).toBe(false);
    expect(addCredentialPoolEntrySpy).not.toHaveBeenCalled();
  });

  it("saves credentials only on a gho_/ghu_ token line", async () => {
    const promise = runCopilotAuthLogin(() => {});
    const proc = lastProc();
    proc.stdout.emit(
      "data",
      Buffer.from(
        "Open this URL: https://github.com/login/device\nEnter code: ABCD-1234\n",
      ),
    );
    proc.stdout.emit(
      "data",
      Buffer.from("__HERMES_COPILOT_TOKEN__:gho_test_token_abc\n"),
    );
    proc.emit("close", 0, null);
    const result = await promise;
    expect(result.success).toBe(true);
    expect(addCredentialPoolEntrySpy).toHaveBeenCalledWith(
      "copilot",
      "gho_test_token_abc",
      "GitHub Copilot (device code)",
      undefined,
    );
  });
});
