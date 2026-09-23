import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Commit } from '../../core/github/github.types';

@Component({
  selector: 'commit-list',
  imports: [DatePipe],
  template: `
    <ol>
      @for (commit of commits(); track commit.sha) {
        <li>
          <a [href]="commit.url" target="_blank" rel="noopener noreferrer">
            <code>{{ commit.sha }}</code>
            <span class="message">{{ commit.message }}</span>
          </a>
          <span class="meta">{{ commit.authorName }} · {{ commit.date | date: 'mediumDate' }}</span>
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
}
