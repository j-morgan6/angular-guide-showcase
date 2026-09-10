import { Component, input } from '@angular/core';

@Component({
  selector: 'md-code',
  template: `
    <pre><code [attr.data-lang]="lang()">{{ code() }}</code></pre>
  `,
  styles: `
    :host { display: block; }
    pre {
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      background: var(--surface-2);
      border-radius: 6px;
    }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.85rem; }
  `,
})
export class MdCode {
  readonly code = input.required<string>();
  readonly lang = input<string>('');
}
