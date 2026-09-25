import { Component, computed, inject, signal } from '@angular/core';
import { ShowcaseApi } from '../../core/api/showcase-api';
import type { Rule } from '../../core/api/showcase.types';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { StaleNotice } from '../../ui/state/stale-notice';
import { RuleCard } from './rule-card';
import { RuleFilters, type KindFilter } from './rule-filters';

@Component({
  selector: 'rules-page',
  imports: [RuleCard, RuleFilters, ErrorState, LoadingSkeleton, StaleNotice],
  template: `
    <h1>Rules</h1>
    <p class="lede">
      Synced from the plugin's own repository by the showcase backend. Add a rule
      to angular-guide and it appears here on the next sync, without a redeploy.
    </p>

    @if (api.rules.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (failure(); as message) {
      <error-state
        [message]="message"
        [stale]="api.isStale()"
        [syncError]="api.syncError()"
        (retry)="api.rules.reload()"
      />
    } @else {
      @if (api.isStale()) {
        <stale-notice [syncError]="api.syncError()" />
      }
      <rule-filters
        [query]="query()"
        [kind]="kind()"
        (queryChange)="setQuery($event)"
        (kindChange)="setKind($event)"
      />
      <p class="count">{{ visible().length }} of {{ rules().length }} rules</p>
      <div class="grid">
        @for (rule of visible(); track rule.ruleId) {
          <rule-card [rule]="rule" />
        } @empty {
          <p class="empty">No rules match that filter.</p>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .lede { color: var(--text-2); max-width: 60ch; line-height: 1.6; }
    .count { color: var(--text-2); font-size: 0.85rem; margin: 0 0 0.75rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
      gap: 1rem;
    }
    .empty { color: var(--text-2); }
  `,
})
export default class RulesPage {
  protected readonly api = inject(ShowcaseApi);

  private readonly queryState = signal('');
  private readonly kindState = signal<KindFilter>('all');

  protected readonly query = this.queryState.asReadonly();
  protected readonly kind = this.kindState.asReadonly();

  protected readonly rules = computed<Rule[]>(() => this.api.rules.value());

  /**
   * The only failure this page can render is a transport failure — the rules
   * shape itself is now validated server-side, so a malformed response is the
   * backend's problem, not this page's.
   */
  protected readonly failure = computed<string | null>(() => {
    const err = this.api.rules.error();
    if (!err) {
      return null;
    }
    return err instanceof Error ? err.message : 'Request failed.';
  });

  protected readonly visible = computed<Rule[]>(() => {
    const needle = this.queryState().trim().toLowerCase();
    const kind = this.kindState();
    return this.rules().filter((rule) => {
      const kindOk = kind === 'all' || rule.kind === kind;
      const textOk =
        needle === '' ||
        rule.ruleId.toLowerCase().includes(needle) ||
        rule.trigger.toLowerCase().includes(needle) ||
        rule.fix.toLowerCase().includes(needle);
      return kindOk && textOk;
    });
  });

  setQuery(value: string): void {
    this.queryState.set(value);
  }

  setKind(value: KindFilter): void {
    this.kindState.set(value);
  }
}
