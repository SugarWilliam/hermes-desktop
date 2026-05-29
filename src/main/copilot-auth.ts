import { spawn, type ChildProcess } from "child_process";
import { homedir } from "os";
import {
  HERMES_HOME,
  HERMES_PYTHON,
  HERMES_REPO,
  getEnhancedPath,
} from "./installer";
import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";
import { stripAnsi } from "./utils";
import { addCredentialPoolEntry } from "./config";

export interface CopilotLoginResult {
  success: boolean;
  error?: string;
}

/** Line prefix for the token line — must not appear in CLI error echoes of our script. */
const TOKEN_LINE_PREFIX = "__HERMES_COPILOT_TOKEN__:";

/**
 * One-liner for `python -c` (Windows cannot reliably pass multiline `-c` args,
 * and `hermesCliArgs(["-c", …])` wrongly routes through `hermes_cli.main`,
 * which treats the script as a session id — issue reported as "No session found
 * matching 'from hermes_cli.copilot_auth…'").
 */
const COPILOT_LOGIN_ONE_LINER =
  "from hermes_cli.copilot_auth import copilot_device_code_login; " +
  "import sys; t=copilot_device_code_login(); " +
  "(not t) and sys.exit(1); " +
  `print("${TOKEN_LINE_PREFIX}"+t, flush=True)`;

let activeCopilotProc: ChildProcess | null = null;

/**
 * GitHub Copilot sign-in via OAuth device code (github.com/login/device).
 * The upstream CLI does not implement \`hermes auth add copilot --type oauth\`;
 * credentials are stored as api_key pool entries (gho_* tokens).
 */
export function runCopilotAuthLogin(
  emit: (chunk: string) => void,
  profile?: string,
): Promise<CopilotLoginResult> {
  return new Promise((resolve) => {
    if (activeCopilotProc) {
      resolve({
        success: false,
        error: "Another sign-in is already in progress.",
      });
      return;
    }

    let proc: ChildProcess;
    try {
      proc = spawn(HERMES_PYTHON, ["-c", COPILOT_LOGIN_ONE_LINER], {
        cwd: HERMES_REPO,
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
          HOME: homedir(),
          HERMES_HOME,
          PYTHONPATH: HERMES_REPO,
          TERM: "dumb",
          PYTHONUNBUFFERED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        ...HIDDEN_SUBPROCESS_OPTIONS,
      });
    } catch (err) {
      resolve({ success: false, error: (err as Error).message });
      return;
    }

    activeCopilotProc = proc;
    let settled = false;
    let stderr = "";

    const finish = (result: CopilotLoginResult): void => {
      if (settled) return;
      settled = true;
      activeCopilotProc = null;
      resolve(result);
    };

    const handleLine = (line: string, isErr: boolean): void => {
      const trimmed = stripAnsi(line).trimEnd();
      if (!trimmed) return;

      if (trimmed.startsWith(TOKEN_LINE_PREFIX)) {
        const token = trimmed.slice(TOKEN_LINE_PREFIX.length).trim();
        // GitHub Copilot OAuth tokens are `gho_` / `ghu_` prefixed.
        if (/^gh[ou]_/.test(token)) {
          try {
            addCredentialPoolEntry(
              "copilot",
              token,
              "GitHub Copilot (device code)",
              profile,
            );
            finish({ success: true });
          } catch (err) {
            finish({
              success: false,
              error: `Failed to save Copilot credentials: ${(err as Error).message}`,
            });
          }
        }
        return;
      }

      if (!isErr || trimmed.length > 0) {
        emit(trimmed + "\n");
      }
    };

    let stdoutBuf = "";
    proc.stdout?.on("data", (data: Buffer) => {
      stdoutBuf += data.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) handleLine(line, false);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += stripAnsi(data.toString());
      emit(stripAnsi(data.toString()));
    });

    proc.on("error", (err) => {
      finish({
        success: false,
        error: `Failed to start Copilot sign-in: ${err.message}`,
      });
    });

    proc.on("close", (code, signal) => {
      if (stdoutBuf) handleLine(stdoutBuf, false);
      if (settled) return;
      if (code === 0) {
        finish({
          success: false,
          error: "Copilot sign-in finished without a token.",
        });
      } else if (signal) {
        finish({ success: false, error: "Sign-in cancelled." });
      } else {
        const hint = stderr.trim().slice(-400);
        finish({
          success: false,
          error: hint
            ? `Sign-in failed (exit ${code}).\n${hint}`
            : `Sign-in exited with code ${code}.`,
        });
      }
    });
  });
}

export function cancelCopilotAuthLogin(): boolean {
  if (!activeCopilotProc) return false;
  activeCopilotProc.kill();
  activeCopilotProc = null;
  return true;
}
