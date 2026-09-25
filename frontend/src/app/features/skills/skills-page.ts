import { Component, computed, inject, signal } from '@angular/core';
import { ShowcaseApi } from '../../core/api/showcase-api';
import { lexMarkdown, stripFrontmatter } from '../../core/parsing/markdown';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { StaleNotice } from '../../ui/state/stale-notice';
import { MdView } from '../../ui/markdown/md-view';

@Component({
  selector: 'skills-page',
  imports: [MdView, ErrorState, LoadingSkeleton, StaleNotice],
  template: `
    <h1>Skills</h1>
    <p class="lede">
      The plugin's judgment-layer skills, rendered from their SKILL.md files by composing
      components over a markdown token tree — no HTML string is ever built. The list comes
      from the backend, so a new skill appears here without a front-end change.
    </p>

    @if (api.isStale() && !doc.error()) {
      <stale-notice [syncError]="api.syncError()" />
    }

    <div class="layout">
      <nav aria-label="Skills">
        @for (skill of skills(); track skill.name) {
          <button
            type="button"
            data-skill
            [class.active]="selected() === skill.name"
            (click)="select(skill.name)"
          >
            {{ skill.name }}
          </button>
        }
      </nav>

      <section>
        @if (doc.isLoading()) {
          <loading-skeleton [rows]="8" />
        } @else if (doc.error(); as err) {
          <error-state
            [message]="messageOf(err)"
            [stale]="api.isStale()"
            [syncError]="api.syncError()"
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
  protected readonly api = inject(ShowcaseApi);
  protected readonly skills = computed(() => this.api.skills.value());

  private readonly selectedState = signal<string | undefined>(undefined);
  protected readonly selected = this.selectedState.asReadonly();

  protected readonly doc = this.api.skillDoc(this.selectedState.asReadonly());

  protected readonly tokens = computed(() =>
    lexMarkdown(stripFrontmatter(this.doc.value()?.body ?? '')),
  );

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }

  select(name: string): void {
    this.selectedState.set(name);
  }
}
