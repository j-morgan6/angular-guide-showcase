import { Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Contributor } from '../../core/api/showcase.types';

@Component({
  selector: 'contributor-card',
  imports: [NgOptimizedImage],
  template: `
    <a [href]="contributor().url" target="_blank" rel="noopener noreferrer">
      <img
        [ngSrc]="contributor().avatarUrl"
        width="48"
        height="48"
        [alt]="contributor().login"
      />
      <span class="login">{{ contributor().login }}</span>
      <span class="count">{{ contributor().contributions }} commits</span>
    </a>
  `,
  styles: `
    :host { display: block; }
    a {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      background: var(--surface-1);
    }
    a:hover { background: var(--surface-2); }
    img { border-radius: 50%; }
    .login { font-weight: 600; }
    .count { margin-left: auto; color: var(--text-2); font-size: 0.85rem; }
  `,
})
export class ContributorCard {
  readonly contributor = input.required<Contributor>();
}
