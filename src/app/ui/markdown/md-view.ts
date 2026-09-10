import { Component, input } from '@angular/core';
import { type MdToken, tokenText } from '../../core/parsing/markdown';
import { MdCode } from './md-code';
import { MdInline } from './md-inline';
import { MdTable } from './md-table';

/** A table token's cells, normalised to plain strings. */
function cells(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((cell) => {
    if (typeof cell === 'string') {
      return cell;
    }
    if (cell && typeof cell === 'object' && 'text' in cell) {
      const text = (cell as { text: unknown }).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  });
}

/**
 * Renders a markdown token tree by composing components.
 *
 * `marked.parser()` is never called, so no HTML string exists at any point —
 * which is why NG014's ban on [innerHTML] costs nothing here. An unrecognised
 * token renders as its own plain text rather than disappearing, so an
 * unhandled construct degrades visibly.
 *
 * Paragraphs, headings, and list items dispatch their own inline tokens
 * (codespan/strong/em/text) to `MdInline`, which applies the same
 * visible-fallback philosophy one level down — see docs/plugin-findings.md
 * for the corpus measurements that motivated this extension.
 */
@Component({
  selector: 'md-view',
  imports: [MdCode, MdTable, MdInline],
  template: `
    @for (token of tokens(); track $index) {
      @switch (token.type) {
        @case ('heading') {
          @switch (depth(token)) {
            @case (1) { <h1><md-inline [tokens]="inlineTokens(token)" /></h1> }
            @case (2) { <h2><md-inline [tokens]="inlineTokens(token)" /></h2> }
            @case (3) { <h3><md-inline [tokens]="inlineTokens(token)" /></h3> }
            @default { <h4><md-inline [tokens]="inlineTokens(token)" /></h4> }
          }
        }
        @case ('paragraph') {
          <p><md-inline [tokens]="inlineTokens(token)" /></p>
        }
        @case ('code') {
          <md-code [code]="text(token)" [lang]="lang(token)" />
        }
        @case ('table') {
          <md-table [header]="tableHeader(token)" [rows]="tableRows(token)" />
        }
        @case ('list') {
          <ul>
            @for (item of listItems(token); track $index) {
              <li><md-inline [tokens]="listItemTokens(item)" /></li>
            }
          </ul>
        }
        @case ('blockquote') {
          <blockquote>{{ text(token) }}</blockquote>
        }
        @case ('space') {
          <!-- nothing to render -->
        }
        @case ('hr') {
          <hr />
        }
        @default {
          <p class="fallback">{{ text(token) }}</p>
        }
      }
    }
  `,
  styles: `
    :host { display: block; }
    h1, h2, h3, h4 { line-height: 1.25; margin: 1.5rem 0 0.5rem; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.3rem; }
    h3 { font-size: 1.1rem; }
    p { margin: 0 0 0.85rem; line-height: 1.6; }
    ul { margin: 0 0 0.85rem 1.25rem; }
    li { margin-bottom: 0.3rem; line-height: 1.55; }
    blockquote {
      margin: 0 0 0.85rem;
      padding-left: 0.9rem;
      border-left: 3px solid var(--border);
      color: var(--text-2);
    }
    .fallback { white-space: pre-wrap; }
  `,
})
export class MdView {
  readonly tokens = input.required<MdToken[]>();

  protected text(token: MdToken): string {
    return tokenText(token);
  }

  protected depth(token: MdToken): number {
    return 'depth' in token && typeof token.depth === 'number' ? token.depth : 4;
  }

  protected lang(token: MdToken): string {
    return 'lang' in token && typeof token.lang === 'string' ? token.lang : '';
  }

  protected tableHeader(token: MdToken): string[] {
    return 'header' in token ? cells((token as { header: unknown }).header) : [];
  }

  protected tableRows(token: MdToken): string[][] {
    if (!('rows' in token)) {
      return [];
    }
    const rows = (token as { rows: unknown }).rows;
    return Array.isArray(rows) ? rows.map((row) => cells(row)) : [];
  }

  /** A token's own inline tokens — also doubles as a list item's block wrapper. */
  protected inlineTokens(token: MdToken): MdToken[] {
    if (!('tokens' in token)) {
      return [];
    }
    const nested = (token as { tokens: unknown }).tokens;
    return Array.isArray(nested) ? (nested as MdToken[]) : [];
  }

  /** A list token's raw items, for recursing into each item's own content. */
  protected listItems(token: MdToken): MdToken[] {
    if (!('items' in token)) {
      return [];
    }
    const items = (token as { items: unknown }).items;
    return Array.isArray(items) ? (items as MdToken[]) : [];
  }

  /**
   * A list item's genuinely-inline tokens. marked wraps an item's content in
   * one or more block-level tokens (usually a single `text` token for a
   * tight item); the real inline stream is one level deeper, on each of
   * those wrappers' own `tokens`.
   */
  protected listItemTokens(item: MdToken): MdToken[] {
    return this.inlineTokens(item).flatMap((block) => this.inlineTokens(block));
  }
}
