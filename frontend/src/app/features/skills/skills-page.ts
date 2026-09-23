import { Component, computed, inject, signal } from '@angular/core';
import { GithubApi, isRateLimitedResource, rateLimitResetOf } from '../../core/github/github-api';
import { lexMarkdown, stripFrontmatter } from '../../core/parsing/markdown';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { MdView } from '../../ui/markdown/md-view';

const SKILLS = [
  'angular-essentials',
  'component-architecture',
  'data-loading',
  'performance-and-zoneless',
  'project-structure',
  'rxjs-interop',
  'signals-essentials',
  'state-management',
  'testing-essentials',
] as const;

@Component({
  selector: 'skills-page',
  imports: [MdView, ErrorState, LoadingSkeleton],
  template: `
    <h1>Skills</h1>
    <p class="lede">
      The nine judgment-layer skills, rendered from their SKILL.md files by composing
      components over a markdown token tree — no HTML string is ever built.
    </p>

    <div class="layout">
      <nav aria-label="Skills">
        @for (name of skills; track name) {
          <button
            type="button"
            data-skill
            [class.active]="selected() === name"
            (click)="select(name)"
          >
            {{ name }}
          </button>
        }
      </nav>

      <section>
        @if (doc.isLoading()) {
          <loading-skeleton [rows]="8" />
        } @else if (doc.error(); as err) {
          <error-state
            [rateLimited]="limited()"
            [message]="messageOf(err)"
            [resetAt]="resetAt()"
            (retry)="doc.reload()"
          />
        } @else if (tokens().length > 0) {
          <md-view [tokens]="tokens()" />
        } @else {
          <p class="hint">Pick a skill to read it.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .lede { color: var(--text-2); max-width: 60ch; line-height: 1.6; }
    .layout { display: grid; grid-template-columns: minmax(12rem, 16rem) 1fr; gap: 2rem; }
    @media (max-width: 48rem) { .layout { grid-template-columns: 1fr; } }
    nav { display: flex; flex-direction: column; gap: 0.25rem; }
    nav button {
      padding: 0.45rem 0.65rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
      text-align: left;
    }
    nav button:hover { background: var(--surface-2); }
    nav button.active { background: var(--surface-3); border-color: var(--border); font-weight: 600; }
    .hint { color: var(--text-2); }
  `,
})
export default class SkillsPage {
  protected readonly api = inject(GithubApi);
  protected readonly skills = SKILLS;

  private readonly selectedState = signal<string | undefined>(undefined);
  protected readonly selected = this.selectedState.asReadonly();

  protected readonly doc = this.api.skillDoc(this.selectedState.asReadonly());

  protected readonly tokens = computed(() =>
    lexMarkdown(stripFrontmatter(this.doc.value() ?? '')),
  );

  /**
   * `GithubApi.isRateLimited()` folds only the four root resources — this
   * page's `doc` resource is created per-skill and is not one of them, so a
   * skill document that 403s after the root resources already succeeded
   * would otherwise show as an ordinary failure instead of "rate limited".
   * OR the two rather than duplicating the 403/header check here.
   */
  protected readonly limited = computed(() => this.api.isRateLimited() || isRateLimitedResource(this.doc));

  protected readonly resetAt = computed(() => rateLimitResetOf(this.doc) ?? this.api.rateLimitResetAt());

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }

  select(name: string): void {
    this.selectedState.set(name);
  }
}
