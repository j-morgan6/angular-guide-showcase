import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Rule } from '../../core/api/showcase.types';
import RulesPage from './rules-page';

const RULES: Rule[] = [
  { ruleId: 'BG002', kind: 'bash', trigger: '`ng build --prod`', fix: 'Run `ng build`.', gate: 'none' },
  {
    ruleId: 'NG001',
    kind: 'blocking',
    trigger: '`standalone` property set to `true` in a decorator',
    fix: 'Delete it.',
    gate: 'v20+',
  },
  { ruleId: 'NG101', kind: 'advisory', trigger: 'Eager route', fix: 'Use loadComponent.', gate: 'none' },
];

const RULES_URL = '/api/plugins/spring-boot-guide/rules';
const SKILLS_URL = '/api/plugins/spring-boot-guide/skills';
const COMMITS_URL = '/api/plugins/spring-boot-guide/activity/commits';
const CONTRIBUTORS_URL = '/api/plugins/spring-boot-guide/activity/contributors';
const SYNC_STATUS_URL = '/api/sync/status';

describe('RulesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * `ShowcaseApi` creates five resources eagerly at construction. Every test
   * drains the other four with a harmless body so it can flush the one it
   * cares about — `rules` — without leaving open requests behind.
   */
  function drainOtherEagerResources(): void {
    http.expectOne(SKILLS_URL).flush([]);
    http.expectOne(COMMITS_URL).flush([]);
    http.expectOne(CONTRIBUTORS_URL).flush([]);
    http.expectOne(SYNC_STATUS_URL).flush({
      status: 'succeeded',
      startedAt: null,
      finishedAt: null,
      rulesSynced: RULES.length,
      error: null,
      stale: false,
    });
  }

  async function renderWithRules(rules: Rule[]) {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http.expectOne(RULES_URL).flush(rules);
    drainOtherEagerResources();
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  it('shows a skeleton while the rules are loading', () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('loading-skeleton'),
    ).not.toBeNull();
    http.expectOne(RULES_URL).flush([]);
    drainOtherEagerResources();
  });

  it('renders one card per rule from the backend, with no stale notice while fresh', async () => {
    const fixture = await renderWithRules(RULES);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card'),
    ).toHaveLength(3);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('stale-notice'),
    ).toBeNull();
  });

  it('filters to blocking rules only', async () => {
    const fixture = await renderWithRules(RULES);
    fixture.componentInstance.setKind('blocking');
    fixture.detectChanges();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG001');
  });

  it('filters by free-text query across id, trigger and fix', async () => {
    const fixture = await renderWithRules(RULES);
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

  it('shows the error state when the backend request fails', async () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http.expectOne(RULES_URL).flush('boom', { status: 500, statusText: 'Server Error' });
    drainOtherEagerResources();
    await Promise.resolve();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('error-state'),
    ).not.toBeNull();
  });

  it('shows a stale-data notice when the last sync failed, even though rules loaded', async () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http.expectOne(RULES_URL).flush(RULES);
    http.expectOne(SKILLS_URL).flush([]);
    http.expectOne(COMMITS_URL).flush([]);
    http.expectOne(CONTRIBUTORS_URL).flush([]);
    http.expectOne(SYNC_STATUS_URL).flush({
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: 'connection refused',
      stale: true,
    });
    await Promise.resolve();
    fixture.detectChanges();
    // Rules loaded successfully, so `failure()` is still null and the page
    // renders the grid, not `error-state` — staleness is a banner concern
    // for pages that surface it, not a hard failure. This asserts the rules
    // still render rather than the page getting stuck on the skeleton, and
    // that the degraded-but-successful state is visible via `stale-notice`
    // above the grid, distinct from the failure state.
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('rule-card')).toHaveLength(3);
    expect(el.querySelector('stale-notice')).not.toBeNull();
    expect(el.querySelector('error-state')).toBeNull();
    const text = el.textContent ?? '';
    expect(text).toContain('out of date');
    expect(text).toContain('connection refused');
  });
});
