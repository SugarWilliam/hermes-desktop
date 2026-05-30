/** Desktop-allocated session ids sent via `X-Hermes-Session-Id` to the gateway API. */
export function isDesktopSessionId(sessionId: string | undefined): boolean {
  return !!sessionId?.startsWith("desk-");
}

/**
 * CLI `hermes chat --resume` only accepts gateway/CLI session ids, not `desk-*`.
 */
export function cliResumeSessionId(
  resumeSessionId?: string,
): string | undefined {
  if (isDesktopSessionId(resumeSessionId)) return undefined;
  return resumeSessionId;
}
