import { Component, input, output } from '@angular/core';
import type { RuleKind } from '../../core/parsing/rules';

export type KindFilter = RuleKind | 'all';

@Component({
  selector: 'rule-filters',
  template: `
    <div class="bar">
      <input
        type="search"
        [value]="query()"
        placeholder="Filter rules…"
        aria-label="Filter rules"
        (input)="queryChange.emit(inputValue($event))"
      />
      <div class="kinds" role="group" aria-label="Rule kind">
        @for (option of options; track option.value) {
          <button
            type="button"
            [class.active]="kind() === option.value"
            (click)="kindChange.emit(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 1.25rem; }
    .bar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    input {
      flex: 1 1 14rem;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      font: inherit;
    }
    .kinds { display: flex; gap: 0.35rem; }
    button {
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
    }
    button.active { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
  `,
})
export class RuleFilters {
  readonly query = input.required<string>();
  readonly kind = input.required<KindFilter>();
  readonly queryChange = output<string>();
  readonly kindChange = output<KindFilter>();

  protected readonly options: ReadonlyArray<{ value: KindFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'blocking', label: 'Blocking' },
    { value: 'advisory', label: 'Advisory' },
    { value: 'bash', label: 'Bash' },
  ];

  protected inputValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement ? target.value : '';
  }
}
