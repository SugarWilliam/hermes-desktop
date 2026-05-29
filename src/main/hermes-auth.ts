import { spawn, type ChildProcess } from "child_process";
import { homedir } from "os";
import {
  HERMES_PYTHON,
  HERMES_REPO,
  HERMES_HOME,
  hermesCliArgs,
  getEnhancedPath,
} from "./installer";
import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";
import { resolveOAuthProviderId } from "../shared/providerLogin";
import { stripAnsi } from "./utils";
import {
  runCopilotAuthLogin,
  cancelCopilotAuthLogin,
} from "./copilot-auth";

export interface OAuthLoginResult {
  success: boolean;
  error?: string;
}

export { detectDeviceCode } from "../shared/deviceCode";

// Only one interactive login can run at a time — the renderer surfaces a
// single modal. Tracked so the renderer can cancel a flow the user
// abandoned (otherwise the CLI's loopback OAuth server lingers).
let activeProc: ChildProcess | null = null;

/**
 * Interactive OAuth sign-in for any provider id the user selects.
 * Copilot uses a direct Python device-code flow; others invoke
 * `hermes auth add <provider> --type oauth` without an allowlist gate.
 */
export function runHermesAuthLogin(
  provider: string,
  emit: (chunk: string) => void,
  profile?: string,
): Promise<OAuthLoginResult> {
  const oauthId = resolveOAuthProviderId(provider);
  if (!oauthId) {
    return Promise.resolve({
      success: false,
      error: "No provider selected for sign-in.",
    });
  }

  if (oauthId === "copilot") {
    return runCopilotAuthLogin(emit, profile);
  }

  return new Promise((resolve) => {
    if (activeProc) {
      resolve({
        success: false,
        error: "Another sign-in is already in progress.",
      });
      return;
    }

    const subArgs =
      profile && profile !== "default"
        ? ["-p", profile, "auth", "add", oauthId, "--type", "oauth"]
        : ["auth", "add", oauthId, "--type", "oauth"];

    let proc: ChildProcess;
    try {
      proc = spawn(HERMES_PYTHON, hermesCliArgs(subArgs), {
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

    activeProc = proc;
    let settled = false;
    const finish = (result: OAuthLoginResult): void => {
      if (settled) return;
      settled = true;
      activeProc = null;
      resolve(result);
    };

    proc.stdout?.on("data", (data: Buffer) => emit(stripAnsi(data.toString())));
    proc.stderr?.on("data", (data: Buffer) => emit(stripAnsi(data.toString())));

    proc.on("error", (err) => {
      finish({
        success: false,
        error: `Failed to start sign-in: ${err.message}`,
      });
    });

    proc.on("close", (code, signal) => {
      if (code === 0) {
        finish({ success: true });
      } else if (signal) {
        finish({ success: false, error: "Sign-in cancelled." });
      } else {
        finish({
          success: false,
          error: `Sign-in exited with code ${code}. This provider may only support API keys — paste a key above instead.`,
        });
      }
    });
  });
}

/**
 * Kill the in-flight login subprocess, if any.
 */
export function cancelHermesAuthLogin(): boolean {
  if (cancelCopilotAuthLogin()) return true;
  if (!activeProc) return false;
  activeProc.kill();
  return true;
}
