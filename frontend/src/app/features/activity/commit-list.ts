import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Commit } from '../../core/api/showcase.types';

/**
 * The backend sends the full-length sha — GitHub's short-sha convention is a
 * display concern, not a storage one, so it's truncated here rather than at
 * the source.
 */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

@Component({
  selector: 'commit-list',
  imports: [DatePipe],
  template: `
    <ol>
      @for (commit of commits(); track commit.sha) {
        <li>
          <a [href]="commit.url" target="_blank" rel="noopener noreferrer">
            <code>{{ shortSha(commit.sha) }}</code>
            <span class="message">{{ commit.message }}</span>
          </a>
          <span class="meta">{{ commit.authorName }} · {{ commit.authoredAt | date: 'mediumDate' }}</span>
        </li>
      } @empty {
        <li class="empty">No commits found.</li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    ol { list-style: none; margin: 0; padding: 0; }
    li { padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
    a { display: flex; gap: 0.6rem; text-decoration: none; color: inherit; align-items: baseline; }
    a:hover .message { text-decoration: underline; }
    code { color: var(--text-2); font-size: 0.8rem; }
    .message { flex: 1; }
    .meta { display: block; margin-top: 0.2rem; color: var(--text-2); font-size: 0.8rem; }
    .empty { color: var(--text-2); }
  `,
})
export class CommitList {
  readonly commits = input.required<Commit[]>();
  protected readonly shortSha = shortSha;
}
