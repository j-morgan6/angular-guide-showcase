import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import RulesPage from './rules-page';

const README = `
| ID | Catches | Fix | Gate |
|---|---|---|---|
| BG002 | \`ng build --prod\` | Run \`ng build\`. | none |
| NG001 | \`standalone\` property set to \`true\` in a decorator | Delete it. | v20+ |
| NG101 | Eager route | Use loadComponent. | none |
`;

describe('RulesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function renderWithReadme(markdown: string) {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/contents/README.md'))
      .flush({ content: btoa(markdown), encoding: 'base64' });
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  it('shows a skeleton while the README is loading', () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('loading-skeleton'),
    ).not.toBeNull();
    http.expectOne((r) => r.url.includes('/contents/README.md')).flush({ content: '' });
  });

  it('renders one card per parsed rule', async () => {
    const fixture = await renderWithReadme(README);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card'),
    ).toHaveLength(3);
  });

  it('filters to blocking rules only', async () => {
    const fixture = await renderWithReadme(README);
    fixture.componentInstance.setKind('blocking');
    fixture.detectChanges();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG001');
  });

  it('filters by free-text query across id, trigger and fix', async () => {
    const fixture = await renderWithReadme(README);
    const cardsFor = (query: string) => {
      fixture.componentInstance.setQuery(query);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card');
    };

    // 'standalone' appears only in NG001's trigger text.
    let cards = cardsFor('standalone');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG001');

    // 'NG101' appears only as NG101's own id — not in any trigger or fix text.
    cards = cardsFor('NG101');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG101');

    // 'loadcomponent' appears only in NG101's fix text — not in any id or trigger.
    cards = cardsFor('loadcomponent');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG101');
  });

  it('shows a parse error naming what it expected when the README has no tables', async () => {
    const fixture = await renderWithReadme('# No tables at all');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('four-column');
  });

  it('shows the rate-limit state when GitHub returns 403 with zero remaining', async () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/contents/README.md')).flush('limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0' },
    });
    await Promise.resolve();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('rate limit');
  });
});
