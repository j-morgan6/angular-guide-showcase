/**
 * Decode GitHub's base64 file content to a UTF-8 string.
 *
 * The contents API wraps base64 at 60 characters, and `atob` rejects the
 * embedded newlines, so they are stripped first. `atob` yields one char per
 * byte, so the bytes are re-decoded as UTF-8 to keep multi-byte characters
 * intact — the plugin's own docs are full of emoji and em-dashes.
 *
 * Never throws: invalid input yields an empty string.
 */
export function decodeBase64(content: string): string {
  if (!content) {
    return '';
  }
  try {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}
