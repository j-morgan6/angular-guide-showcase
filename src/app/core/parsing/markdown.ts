import { lexer, type Token } from 'marked';

/** A lexed markdown token. Re-exported so nothing else imports from `marked` directly. */
export type MdToken = Token;

/**
 * Lex markdown into a token tree.
 *
 * We deliberately never call `marked.parser()` — that is the step that would
 * produce an HTML string, and NG014 blocks binding HTML into the DOM. Rendering
 * happens by composing components over these tokens instead, so no HTML string
 * is ever constructed and there is nothing to sanitise.
 *
 * Never throws: malformed markdown yields whatever tokens were recoverable.
 */
export function lexMarkdown(src: string): MdToken[] {
  if (!src) {
    return [];
  }
  try {
    return lexer(src);
  } catch {
    return [];
  }
}

/** Best-effort plain text for a token, for fallback rendering and assertions. */
export function tokenText(token: MdToken): string {
  if ('text' in token && typeof token.text === 'string') {
    return token.text;
  }
  if ('raw' in token && typeof token.raw === 'string') {
    return token.raw;
  }
  return '';
}
