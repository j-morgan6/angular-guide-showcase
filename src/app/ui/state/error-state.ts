import { Component, computed, input, output } from '@angular/core';

/**
 * Loading, rate-limited and failed are deliberately distinct. Collapsing them
 * into one generic error is what the data-loading skill warns against: a user
 * who is rate limited needs to know to wait, not to retry harder.
 */
@Component({
  selector: 'error-state',
  template: `
    <div class="box" role="alert" [class.limited]="rateLimited()">
      @if (rateLimited()) {
        <h3>GitHub rate limit reached</h3>
        <p>
          This dashboard reads the GitHub API without a token, which allows
          60 requests per hour per IP.
          @if (resetLabel(); as at) {
            The limit resets at {{ at }}.
          } @else {
            The limit resets within the hour.
          }
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
  /** Unix-epoch seconds from `x-ratelimit-reset`, when known. */
  readonly resetAt = input<number | undefined>(undefined);
  readonly retry = output<void>();

  /**
   * `HH:MM` in the viewer's local time, or undefined when there is no reset
   * time to show — either because none was given, or because it didn't parse
   * to a valid date. Undefined falls back to the vaguer "within the hour"
   * copy in the template rather than rendering `Invalid Date`.
   */
  protected readonly resetLabel = computed<string | undefined>(() => {
    const reset = this.resetAt();
    if (reset === undefined) {
      return undefined;
    }
    const date = new Date(reset * 1000);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });
}
