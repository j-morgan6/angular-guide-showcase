import { Component, input } from '@angular/core';

@Component({
  selector: 'md-table',
  template: `
    <div class="scroll">
      <table>
        <thead>
          <tr>
            @for (cell of header(); track $index) {
              <th>{{ cell }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (cell of row; track $index) {
                <td>{{ cell }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 1rem; }
    .scroll { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); text-align: left; }
    th { font-weight: 600; }
  `,
})
export class MdTable {
  readonly header = input.required<string[]>();
  readonly rows = input.required<string[][]>();
}
