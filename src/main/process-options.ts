/** Win32 `CREATE_NO_WINDOW` — suppress console allocation on child spawn (#342). */
const CREATE_NO_WINDOW = 0x08000000;

/**
 * Hide console windows for child processes on Windows.
 * Pair with `HERMES_PYTHON` → `pythonw.exe` (installer.ts) so the interpreter
 * itself is GUI-subsystem and never allocates a console (#342).
 */
export const HIDDEN_SUBPROCESS_OPTIONS =
  process.platform === "win32"
    ? ({ windowsHide: true, creationFlags: CREATE_NO_WINDOW } as const)
    : ({ windowsHide: true } as const);

export function hiddenSubprocessOptions<T extends object>(
  options: T,
): T & typeof HIDDEN_SUBPROCESS_OPTIONS {
  return { ...options, ...HIDDEN_SUBPROCESS_OPTIONS };
}

/** Options for `execFile` / `execFileSync` — same hiding semantics. */
export const HIDDEN_EXEC_OPTIONS = { ...HIDDEN_SUBPROCESS_OPTIONS } as const;
