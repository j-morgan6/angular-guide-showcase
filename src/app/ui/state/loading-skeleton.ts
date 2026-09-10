import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'loading-skeleton',
  template: `
    @for (row of placeholders(); track $index) {
      <div class="bar"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .bar {
      height: 1rem;
      margin-bottom: 0.6rem;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 37%, var(--surface-2) 63%);
      background-size: 400% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar { animation: none; }
    }
  `,
})
export class LoadingSkeleton {
  readonly rows = input<number>(3);
  protected readonly placeholders = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i),
  );
}
