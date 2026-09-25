import { Component, input } from '@angular/core';

/**
 * An unobtrusive banner for a successful fetch whose data may not be fresh —
 * the backend's last sync failed, or finished longer ago than the sync
 * interval allows. This is the "degraded" state from the design spec:
 * distinct from `loading` and from `error-state`'s `failed` state, because
 * the fetch itself succeeded. `role="status"` (polite) rather than
 * `error-state`'s `role="alert"`, and no retry action — there is nothing to
 * retry, the content already rendered.
 */
@Component({
  selector: 'stale-notice',
  template: `
    <p class="notice" role="status">Data may be out of date — {{ syncError() ?? 'last sync failed' }}</p>
  `,
  styles: `
    :host { display: block; }
    .notice {
      margin: 0 0 1rem;
      padding: 0.5rem 0.75rem;
      border-left: 3px solid var(--warn);
      border-radius: 0 6px 6px 0;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 0.85rem;
    }
  `,
})
export class StaleNotice {
  /** The error from the last failed sync, shown in place of the generic fallback text when present. */
  readonly syncError = input<string | undefined>(undefined);
}
