import { Component, computed, inject, signal } from '@angular/core';
import { GithubApi } from '../../core/github/github-api';
import { parseRules, parseRulesOrThrow, type Rule } from '../../core/parsing/rules';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { RuleCard } from './rule-card';
import { RuleFilters, type KindFilter } from './rule-filters';

@Component({
  selector: 'rules-page',
  imports: [RuleCard, RuleFilters, ErrorState, LoadingSkeleton],
  template: `
    <h1>Rules</h1>
    <p class="lede">
      Parsed live from the plugin's own README. Add a rule to angular-guide and it
      appears here without a redeploy.
    </p>

    @if (api.readme.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (failure(); as message) {
      <error-state
        [rateLimited]="api.isRateLimited()"
        [message]="message"
        (retry)="api.readme.reload()"
      />
    } @else {
      <rule-filters
        [query]="query()"
        [kind]="kind()"
        (queryChange)="setQuery($event)"
        (kindChange)="setKind($event)"
      />
      <p class="count">{{ visible().length }} of {{ rules().length }} rules</p>
      <div class="grid">
        @for (rule of visible(); track rule.id) {
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
  protected readonly api = inject(GithubApi);

  private readonly queryState = signal('');
  private readonly kindState = signal<KindFilter>('all');

  protected readonly query = this.queryState.asReadonly();
  protected readonly kind = this.kindState.asReadonly();

  protected readonly rules = computed<Rule[]>(() => {
    const readme = this.api.readme.value();
    return readme ? parseRules(readme) : [];
  });

  /**
   * Transport failure and parse failure are different problems and get
   * different messages. A parse failure means the README changed shape, which
   * is a real risk when reading a document this repo does not control.
   *
   * The parse-failure message comes from `parseRulesOrThrow` rather than being
   * reconstructed here, so there is exactly one place that owns what shape a
   * valid rules table is expected to have.
   */
  protected readonly failure = computed<string | null>(() => {
    const err = this.api.readme.error();
    if (err) {
      return err instanceof Error ? err.message : 'Request failed.';
    }
    const readme = this.api.readme.value();
    if (!readme) {
      return null;
    }
    try {
      parseRulesOrThrow(readme);
      return null;
    } catch (parseError) {
      return parseError instanceof Error ? parseError.message : 'Could not parse rules.';
    }
  });

  protected readonly visible = computed<Rule[]>(() => {
    const needle = this.queryState().trim().toLowerCase();
    const kind = this.kindState();
    return this.rules().filter((rule) => {
      const kindOk = kind === 'all' || rule.kind === kind;
      const textOk =
        needle === '' ||
        rule.id.toLowerCase().includes(needle) ||
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
