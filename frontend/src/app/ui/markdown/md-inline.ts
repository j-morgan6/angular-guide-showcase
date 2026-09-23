import { Component, input } from '@angular/core';
import { type MdToken, tokenText } from '../../core/parsing/markdown';

/**
 * Renders a stream of inline markdown tokens by composing elements —
 * `codespan` becomes `<code>`, `strong`/`em` become their native elements
 * and recurse into their own nested tokens via this same component. Anything
 * else — including `link`, deliberately unhandled; see docs/plugin-findings.md
 * for why — falls through to plain interpolated text rather than vanishing.
 *
 * No HTML string is ever built here either: recursion is component
 * composition (`<md-inline [tokens]="…" />` nested inside itself), not
 * string concatenation.
 */
@Component({
  selector: 'md-inline',
  imports: [MdInline],
  template: `
    @for (token of tokens(); track $index) {
      @switch (token.type) {
        @case ('codespan') {
          <code>{{ text(token) }}</code>
        }
        @case ('strong') {
          <strong><md-inline [tokens]="children(token)" /></strong>
        }
        @case ('em') {
          <em><md-inline [tokens]="children(token)" /></em>
        }
        @case ('text') {{{ text(token) }}}
        @case ('escape') {{{ text(token) }}}
        @default {{{ text(token) }}}
      }
    }
  `,
})
export class MdInline {
  readonly tokens = input.required<MdToken[]>();

  protected text(token: MdToken): string {
    return tokenText(token);
  }

  /** A `strong`/`em` token's own nested inline tokens, for recursion. */
  protected children(token: MdToken): MdToken[] {
    if (!('tokens' in token)) {
      return [];
    }
    const nested = (token as { tokens: unknown }).tokens;
    return Array.isArray(nested) ? (nested as MdToken[]) : [];
  }
}
