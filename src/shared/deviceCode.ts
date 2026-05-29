/**
 * Parse a device-code login prompt out of CLI / Python streamed output.
 * Returns null until both URL and code are present. Only `https:` URLs are
 * accepted (fed to `shell.openExternal` in the main process).
 */
export function detectDeviceCode(
  text: string,
): { url: string; code: string } | null {
  const codexUrl = text.match(
    /Open this URL in your browser:[^\S\n]*\n[^\S\n]*(https:\/\/\S+)/,
  );
  const codexCode = text.match(/Enter this code:[^\S\n]*\n[^\S\n]*(\S+)/);
  if (codexUrl && codexCode) {
    return { url: codexUrl[1], code: codexCode[1] };
  }

  const ghUrl =
    text.match(
      /Open this URL in your browser:\s*(https:\/\/[^\s]*login\/device[^\s]*)/i,
    ) ||
    text.match(
      /(?:Go to|Visit|Open)(?:\s+this\s+URL)?:\s*(https:\/\/[^\s]*login\/device[^\s]*)/i,
    ) ||
    text.match(
      /(?:Go to|Visit|Open)(?:\s+this\s+URL)?:[^\S\n]*\n[^\S\n]*(https:\/\/[^\s]*login\/device[^\s]*)/i,
    ) ||
    text.match(
      /(?:verification_uri|Go to):[^\S\n]*\n[^\S\n]*(https:\/\/[^\s]*login\/device[^\s]*)/i,
    );
  const ghCode =
    text.match(/Enter this code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i) ||
    text.match(
      /(?:Enter code|Enter this code):\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i,
    ) ||
    text.match(
      /(?:Enter code|Enter this code):[^\S\n]*\n[^\S\n]*([A-Z0-9]{4}-[A-Z0-9]{4})/i,
    ) ||
    text.match(/user_code["']?\s*:\s*"?([A-Z0-9]{4}-[A-Z0-9]{4})"?/i);
  if (ghUrl && ghCode) {
    return { url: ghUrl[1], code: ghCode[1] };
  }

  return null;
}
