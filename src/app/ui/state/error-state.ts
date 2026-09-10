import { Component, input, output } from '@angular/core';

/**
 * Loading, rate-limited and failed are deliberately distinct. Collapsing them
 * into one generic error is what the data-loading skill warns against: a user
 * who is rate limited needs to know to wait, not to retry harder.
 */
@Component({
  selector: 'error-state',
  template: `
    <div class="box" [class.limited]="rateLimited()">
      @if (rateLimited()) {
        <h3>GitHub rate limit reached</h3>
        <p>
          This dashboard reads the GitHub API without a token, which allows
          60 requests per hour per IP. The limit resets within the hour.
        </p>
      } @else {
        <h3>Couldn't load this</h3>
        <p>{{ message() }}</p>
      }
      <button type="button" (click)="retry.emit()">Try again</button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .box {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-2);
    }
    .box.limited { border-color: var(--warn); }
    h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    p { margin: 0 0 0.9rem; color: var(--text-2); line-height: 1.55; }
    button {
      padding: 0.4rem 0.9rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      cursor: pointer;
      font: inherit;
    }
    button:hover { background: var(--surface-3); }
  `,
})
export class ErrorState {
  readonly rateLimited = input.required<boolean>();
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
