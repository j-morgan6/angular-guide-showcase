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

  it('never throws on malformed input', () => {
    expect(() => lexMarkdown('```unterminated\n\n| broken |')).not.toThrow();
  });

  it('extracts plain text from a token', () => {
    const tokens = lexMarkdown('Some **bold** text');
    expect(tokenText(tokens[0])).toContain('bold');
  });
});
