/**
 * Append short troubleshooting hints for known upstream gateway errors.
 */
export function enrichChatErrorMessage(
  error: string,
  hints: {
    codexTtfb?: string;
    contextLength?: string;
    agentIdle?: string;
    sessionNotFound?: string;
    apiServerKey?: string;
    gatewayApiUnavailable?: string;
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
  if (lower.includes("session not found")) {
    const hint = hints.sessionNotFound;
    return hint ? `${error}\n\n${hint}` : error;
  }
  if (
    lower.includes("api_server_key is required") ||
    lower.includes("api_server_key is not configured") ||
    (lower.includes("api server") && lower.includes("refusing to start"))
  ) {
    const hint = hints.apiServerKey;
    return hint ? `${error}\n\n${hint}` : error;
  }
  if (
    lower.includes("gateway api is unavailable") ||
    lower.includes("gateway api health check failed")
  ) {
    const hint = hints.gatewayApiUnavailable ?? hints.apiServerKey;
    return hint ? `${error}\n\n${hint}` : error;
  }
  return error;
}
