import { Component, inject } from '@angular/core';
import { GithubApi } from '../../core/github/github-api';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { CommitList } from './commit-list';
import { ContributorCard } from './contributor-card';

@Component({
  selector: 'activity-page',
  imports: [CommitList, ContributorCard, ErrorState, LoadingSkeleton],
  template: `
    <h1>Activity</h1>

    @if (api.repo.value(); as repo) {
      <dl class="stats">
        <div><dt>Stars</dt><dd>{{ repo.stars }}</dd></div>
        <div><dt>Forks</dt><dd>{{ repo.forks }}</dd></div>
        <div><dt>Open issues</dt><dd>{{ repo.openIssues }}</dd></div>
      </dl>
    }

    <h2>Recent commits</h2>
    @if (api.commits.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (api.commits.error(); as err) {
      <error-state
        [rateLimited]="api.isRateLimited()"
        [message]="messageOf(err)"
        (retry)="api.commits.reload()"
      />
    } @else {
      <commit-list [commits]="api.commits.value() ?? []" />
    }

    @defer (on viewport) {
      <h2>Contributors</h2>
      @if (api.contributors.isLoading()) {
        <loading-skeleton [rows]="2" />
      } @else {
        <div class="contributors">
          @for (person of api.contributors.value() ?? []; track person.login) {
            <contributor-card [contributor]="person" />
          }
        </div>
      }
    } @placeholder {
      <div class="defer-placeholder"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .stats { display: flex; gap: 2rem; margin: 0 0 2rem; }
    .stats dt { color: var(--text-2); font-size: 0.8rem; }
    .stats dd { margin: 0.1rem 0 0; font-size: 1.4rem; font-weight: 600; }
    h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; }
    .contributors {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
      gap: 0.75rem;
    }
    .defer-placeholder { min-height: 6rem; }
  `,
})
export default class ActivityPage {
  protected readonly api = inject(GithubApi);

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }
}
