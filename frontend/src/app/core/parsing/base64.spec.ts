import { describe, expect, it } from 'vitest';
import { decodeBase64 } from './base64';

describe('decodeBase64', () => {
  it('decodes plain base64', () => {
    expect(decodeBase64('aGVsbG8=')).toBe('hello');
  });

  it('ignores the newlines GitHub inserts every 60 characters', () => {
    const withNewlines = 'aGVs\nbG8=';
    expect(decodeBase64(withNewlines)).toBe('hello');
  });

  it('round-trips multi-byte UTF-8', () => {
    const source = '# Título — 🚫 blocked';
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(source)));
    expect(decodeBase64(encoded)).toBe(source);
  });

  it('returns an empty string for empty input', () => {
    expect(decodeBase64('')).toBe('');
  });

  it('never throws on invalid base64', () => {
    expect(() => decodeBase64('!!!not base64!!!')).not.toThrow();
  });
});
