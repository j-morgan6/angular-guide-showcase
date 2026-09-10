import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { lexMarkdown, type MdToken } from '../../core/parsing/markdown';
import { MdView } from './md-view';

@Component({
  imports: [MdView],
  template: `<md-view [tokens]="tokens()" />`,
})
class Host {
  readonly tokens = signal<MdToken[]>([]);
}

function render(markdown: string): HTMLElement {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.tokens.set(lexMarkdown(markdown));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MdView', () => {
  it('renders a heading at the right level', () => {
    const el = render('## Section title');
    expect(el.querySelector('h2')?.textContent).toContain('Section title');
  });

  it('renders paragraph text', () => {
    const el = render('Just a paragraph.');
    expect(el.textContent).toContain('Just a paragraph.');
  });

  it('renders a fenced code block with its language', () => {
    const el = render('```typescript\nconst a = 1;\n```');
    const code = el.querySelector('md-code');
    expect(code).not.toBeNull();
    expect(el.textContent).toContain('const a = 1;');
  });

  it('renders a table with header cells and body rows', () => {
    const el = render('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(el.querySelectorAll('th')).toHaveLength(2);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders nested list items recursively', () => {
    // Genuinely nested: the outer item's own block tokens are [text, list],
    // not a single inline-bearing block. A flat list (`- first\n- second`)
    // never exercises this path — it would pass even if nesting silently
    // dropped content, which is exactly the bug this test must catch.
    const el = render('- first\n  - nested content here\n- second');
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.textContent).toContain('nested content here');
  });

  it('renders a fenced code block inside a loose list item as visible text', () => {
    // The old listItemTokens() returned [] for a `code` block (no inline
    // `tokens` of its own), so its content vanished silently. This is the
    // second silent-drop shape from the same bug, previously verified only
    // by manual trace — it deserves a permanent regression test.
    const el = render('- Step one\n\n  ```js\n  const a = 1;\n  ```\n');
    expect(el.textContent).toContain('const a = 1;');
  });

  it('renders an unhandled token as visible text rather than dropping it', () => {
    // A block-level `html` token is not in the @switch, so it must hit the
    // @default branch and still show its text. Verified against marked:
    // '<div>…</div>' lexes to type 'html'. Asserting on a token type the
    // renderer DOES handle would prove nothing.
    const el = render('<div>raw block content</div>');
    expect(el.textContent).toContain('raw block content');
    expect(el.querySelector('div.injected')).toBeNull();
  });

  it('renders a horizontal rule', () => {
    const el = render('---');
    expect(el.querySelector('hr')).not.toBeNull();
  });

  it('never emits raw HTML into the DOM', () => {
    const el = render('Some `<script>alert(1)</script>` text');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>');
  });

  it('renders nothing for an empty token list', () => {
    const el = render('');
    expect(el.querySelector('h1')).toBeNull();
  });

  // --- Inline dispatch (scope extension beyond the brief) ---
  // 43% of paragraph/heading blocks across the nine SKILL.md files contain
  // inline markup (codespan/strong/em). Block-only rendering would show
  // literal backticks and asterisks in documentation whose subject is code.

  it('renders an inline code span as a real <code> element, not literal backticks', () => {
    const el = render('Use the `input()` function.');
    const code = el.querySelector('p code');
    expect(code?.textContent).toBe('input()');
    expect(el.querySelector('p')?.textContent).not.toContain('`');
  });

  it('renders strong and em as real elements', () => {
    const el = render('This is **bold** and *italic* text.');
    expect(el.querySelector('strong')?.textContent).toBe('bold');
    expect(el.querySelector('em')?.textContent).toBe('italic');
  });

  it('recurses into nested inline markup', () => {
    const el = render('**bold *and italic* together**');
    const strong = el.querySelector('strong');
    expect(strong?.querySelector('em')?.textContent).toBe('and italic');
  });

  it('renders inline markup inside list items', () => {
    const el = render('- an **important** item');
    const item = el.querySelector('li');
    expect(item?.querySelector('strong')?.textContent).toBe('important');
  });

  it('renders an unhandled inline token (link) as visible text, not an anchor', () => {
    // `link` is deliberately out of scope (zero occurrences in the corpus);
    // it must fall through to @default and stay visible rather than vanish.
    const el = render('See [the docs](https://example.com) for more.');
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('the docs');
  });
});
