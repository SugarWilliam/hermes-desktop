/**
 * Append short troubleshooting hints for known upstream gateway errors.
 */
export function enrichChatErrorMessage(
  error: string,
  hints: {
    codexTtfb?: string;
    contextLength?: string;
    agentIdle?: string;
  },
): string {
  const lower = error.toLowerCase();
  if (
    lower.includes("codex stream produced no bytes") ||
    lower.includes("ttfb threshold") ||
    lower.includes("ttfb cutoff")
  ) {
    const hint = hints.codexTtfb;
    return hint ? `${error}\n\n${hint}` : error;
  }
  if (
    lower.includes("context length exceeded") ||
    lower.includes("cannot compress further") ||
    lower.includes("compression_exhausted") ||
    lower.includes("max compression attempts")
  ) {
    const hint = hints.contextLength;
    return hint ? `${error}\n\n${hint}` : error;
  }
  if (
    lower.includes("agent produced no output") ||
    (lower.includes("no output for") && lower.includes("minute"))
  ) {
    const hint = hints.agentIdle;
    return hint ? `${error}\n\n${hint}` : error;
  }
  return error;
}
