import { describe, expect, it } from 'vitest';
import { lexMarkdown, stripFrontmatter, tokenText } from './markdown';

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

describe('stripFrontmatter', () => {
  it('strips a leading ---delimited frontmatter block', () => {
    const src = [
      '---',
      'name: signals-essentials',
      'description: MANDATORY for all signal work.',
      '---',
      '',
      '# Signals Essentials',
      '',
      'Body text.',
    ].join('\n');
    const stripped = stripFrontmatter(src);
    expect(stripped).not.toContain('name: signals-essentials');
    expect(stripped).not.toContain('description:');
    expect(stripped).toContain('# Signals Essentials');
    expect(stripped).toContain('Body text.');
  });

  it('leaves a document with no frontmatter untouched', () => {
    const src = '# Title\n\nJust a normal document with no frontmatter.';
    expect(stripFrontmatter(src)).toBe(src);
  });

  it('does not strip a --- horizontal rule that appears mid-document', () => {
    const src = '# Title\n\nAbove the rule.\n\n---\n\nBelow the rule.';
    expect(stripFrontmatter(src)).toBe(src);
  });

  it('handles empty input', () => {
    expect(stripFrontmatter('')).toBe('');
  });
});
