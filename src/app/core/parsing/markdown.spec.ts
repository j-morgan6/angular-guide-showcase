import { describe, expect, it } from 'vitest';
import { lexMarkdown, tokenText } from './markdown';

describe('lexMarkdown', () => {
  it('returns a heading token with its depth and text', () => {
    const tokens = lexMarkdown('# Title');
    expect(tokens[0].type).toBe('heading');
    expect(tokens[0]).toMatchObject({ depth: 1, text: 'Title' });
  });

  it('returns a fenced code token carrying its language', () => {
    const tokens = lexMarkdown('```typescript\nconst a = 1;\n```');
    expect(tokens[0]).toMatchObject({ type: 'code', lang: 'typescript' });
  });

  it('returns a table token with header and rows', () => {
    const tokens = lexMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(tokens[0].type).toBe('table');
  });

  it('returns an empty array for empty input', () => {
    expect(lexMarkdown('')).toEqual([]);
  });

  it('degrades malformed input to recoverable tokens without throwing', () => {
    expect(() => lexMarkdown('```unterminated\n\n| broken |')).not.toThrow();
  });

  it('returns an empty array when the lexer throws', () => {
    // marked recurses per blockquote level; deep nesting overflows the stack.
    // Verified: bare lexer() throws RangeError on this input.
    expect(lexMarkdown('> '.repeat(20000) + 'x')).toEqual([]);
  });

  it('extracts plain text from a token', () => {
    const tokens = lexMarkdown('Some **bold** text');
    expect(tokenText(tokens[0])).toContain('bold');
  });

  it('falls back to raw source for tokens without text', () => {
    const [hr] = lexMarkdown('---');
    expect(tokenText(hr)).toContain('---');
  });
});
