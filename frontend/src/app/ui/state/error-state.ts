import { Component, input, output } from '@angular/core';

/**
 * Loading, stale and failed are deliberately distinct. Collapsing them into
 * one generic error is what the data-loading skill warns against: a user
 * looking at stale-but-successful data needs to know it may be out of date,
 * not that the request failed.
 */
@Component({
  selector: 'error-state',
  template: `
    <div class="box" role="alert" [class.limited]="stale()">
      @if (stale()) {
        <h3>Data may be out of date</h3>
        <p>{{ syncError() ?? "The last sync from GitHub hasn't completed successfully." }}</p>
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
  readonly message = input.required<string>();
  /**
   * True when the backend's data is not fresh — the last sync failed, or is
   * older than the sync interval allows. This is the *failure*-path stale
   * indication (the fetch itself also failed); a successful-but-stale fetch
   * is shown by the separate `stale-notice` component instead.
   */
  readonly stale = input(false);
  /** The error from the last failed sync, shown in place of the generic stale copy when present. */
  readonly syncError = input<string | undefined>(undefined);
  readonly retry = output<void>();
}
