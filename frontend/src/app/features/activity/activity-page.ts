import { Component, inject } from '@angular/core';
import { ShowcaseApi } from '../../core/api/showcase-api';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { StaleNotice } from '../../ui/state/stale-notice';
import { CommitList } from './commit-list';
import { ContributorCard } from './contributor-card';

@Component({
  selector: 'activity-page',
  imports: [CommitList, ContributorCard, ErrorState, LoadingSkeleton, StaleNotice],
  template: `
    <h1>Activity</h1>

    @if (api.isStale() && !api.commits.error()) {
      <stale-notice [syncError]="api.syncError()" />
    }

    <h2>Recent commits</h2>
    @if (api.commits.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (api.commits.error(); as err) {
      <error-state
        [message]="messageOf(err)"
        [stale]="api.isStale()"
        [syncError]="api.syncError()"
        (retry)="api.commits.reload()"
      />
    } @else {
      <commit-list [commits]="api.commits.value() ?? []" />
    }

    @defer (on viewport) {
      <h2>Contributors</h2>
      @if (api.contributors.isLoading()) {
        <loading-skeleton [rows]="2" />
      } @else if (api.contributors.error(); as err) {
        <error-state
          [message]="messageOf(err)"
          [stale]="api.isStale()"
          [syncError]="api.syncError()"
          (retry)="api.contributors.reload()"
        />
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
    h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; }
    h2:first-of-type { margin-top: 0; }
    .contributors {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
      gap: 0.75rem;
    }
    .defer-placeholder { min-height: 6rem; }
  `,
})
export default class ActivityPage {
  protected readonly api = inject(ShowcaseApi);

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }
}
