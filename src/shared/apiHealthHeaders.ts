/** Build Authorization headers for GET /health (same rules as chat API). */
export function buildApiHealthHeaders(opts: {
  mode: "local" | "remote" | "ssh";
  apiServerKey?: string;
  remoteApiKey?: string;
  sshApiKey?: string;
}): Record<string, string> {
  if (opts.mode === "ssh") {
    if (opts.sshApiKey) {
      return { Authorization: `Bearer ${opts.sshApiKey}` };
    }
    return {};
  }
  if (opts.mode === "remote" && opts.remoteApiKey) {
    return { Authorization: `Bearer ${opts.remoteApiKey}` };
  }
  if (opts.mode === "local" && opts.apiServerKey) {
    return { Authorization: `Bearer ${opts.apiServerKey}` };
  }
  return {};
}
