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

/**
 * Strips a leading YAML frontmatter block (`---` ... `---`) from markdown
 * source. Only a delimiter that opens the document is treated as
 * frontmatter — a `---` appearing later, e.g. a genuine horizontal rule, is
 * left untouched, and a leading `---` with no matching close is left
 * untouched too (it is not frontmatter, just an opening rule).
 *
 * This is a content decision, not a transport concern (`GithubApi.skillDoc`
 * should not own it) and not `MdView`'s concern either (it must stay
 * content-agnostic and render whatever tokens it is given) — so it lives
 * here as its own pure function, applied by the caller that knows the
 * content is a SKILL.md.
 */
export function stripFrontmatter(src: string): string {
  if (!src.startsWith('---')) {
    return src;
  }
  const lines = src.split('\n');
  if (lines[0].trim() !== '---') {
    return src;
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    return src;
  }
  return lines.slice(closingIndex + 1).join('\n');
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
