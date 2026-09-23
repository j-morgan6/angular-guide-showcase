import { Component, input } from '@angular/core';
import type { Rule } from '../../core/api/showcase.types';

@Component({
  selector: 'rule-card',
  template: `
    <article>
      <header>
        <code class="id" [class.blocking]="rule().kind === 'blocking'"
              [class.advisory]="rule().kind === 'advisory'"
              [class.bash]="rule().kind === 'bash'">{{ rule().ruleId }}</code>
        @if (rule().gate !== 'none') {
          <span class="gate">{{ rule().gate }}</span>
        }
      </header>
      <p class="trigger">{{ rule().trigger }}</p>
      <p class="fix">{{ rule().fix }}</p>
    </article>
  `,
  styles: `
    :host { display: block; }
    article {
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-1);
      height: 100%;
    }
    header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
    .id { font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 4px; }
    .id.blocking { background: var(--danger-bg); color: var(--danger); }
    .id.advisory { background: var(--warn-bg); color: var(--warn); }
    .id.bash { background: var(--surface-3); color: var(--text-2); }
    .gate { font-size: 0.75rem; color: var(--text-2); }
    .trigger { margin: 0 0 0.5rem; line-height: 1.5; }
    .fix { margin: 0; color: var(--text-2); font-size: 0.9rem; line-height: 1.5; }
  `,
})
export class RuleCard {
  readonly rule = input.required<Rule>();
}
