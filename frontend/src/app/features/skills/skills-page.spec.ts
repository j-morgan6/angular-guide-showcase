import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import type { SkillSummary, SyncStatus } from '../../core/api/showcase.types';
import SkillsPage from './skills-page';

const RULES_URL = '/api/plugins/angular-guide/rules';
const SKILLS_URL = '/api/plugins/angular-guide/skills';
const COMMITS_URL = '/api/plugins/angular-guide/activity/commits';
const CONTRIBUTORS_URL = '/api/plugins/angular-guide/activity/contributors';
const SYNC_STATUS_URL = '/api/sync/status';

const SKILLS_FIXTURE: SkillSummary[] = [
  { name: 'angular-essentials' },
  { name: 'signals-essentials' },
  { name: 'testing-essentials' },
];

function freshSyncStatus(): SyncStatus {
  return {
    status: 'succeeded',
    startedAt: null,
    finishedAt: null,
    rulesSynced: 0,
    error: null,
    stale: false,
  };
}

describe('SkillsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * `ShowcaseApi` creates five resources eagerly at construction. Every test
   * drains the four this page doesn't primarily exercise (`rules`, `skills`,
   * `commits`, `contributors`) with harmless bodies and flushes `syncStatus`
   * with the given status, so it can exercise the skills list and the
   * per-skill `doc` resource without leaving open requests behind.
   */
  function drainRootResources(syncStatus: SyncStatus = freshSyncStatus()): void {
    http.expectOne(RULES_URL).flush([]);
    http.expectOne(SKILLS_URL).flush(SKILLS_FIXTURE);
    http.expectOne(COMMITS_URL).flush([]);
    http.expectOne(CONTRIBUTORS_URL).flush([]);
    http.expectOne(SYNC_STATUS_URL).flush(syncStatus);
  }

  it('lists the skills returned by the backend, in order, with no stale notice while fresh', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources();
    await Promise.resolve();
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-skill]'),
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'angular-essentials',
      'signals-essentials',
      'testing-essentials',
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('stale-notice'),
    ).toBeNull();
  });

  it('renders the selected skill document through the token renderer', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources();
    await Promise.resolve();
    fixture.detectChanges();

    fixture.componentInstance.select('signals-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/skills/signals-essentials'))
      .flush({ name: 'signals-essentials', body: '## Decision table\n\nUse computed().' });
    await Promise.resolve();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('md-view')).not.toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('Decision table');
  });

  it('strips YAML frontmatter before rendering, so it never appears as content', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources();
    await Promise.resolve();
    fixture.detectChanges();

    fixture.componentInstance.select('rxjs-interop');
    fixture.detectChanges();
    const frontmatterDoc = [
      '---',
      'name: rxjs-interop',
      'description: MANDATORY for ALL RxJS work.',
      '---',
      '',
      '# RxJS Interop',
      '',
      'Body text.',
    ].join('\n');
    http
      .expectOne((r) => r.url.includes('/skills/rxjs-interop'))
      .flush({ name: 'rxjs-interop', body: frontmatterDoc });
    await Promise.resolve();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('name: rxjs-interop');
    expect(text).not.toContain('description:');
    expect(text).toContain('RxJS Interop');
  });

  it('shows the error state when the selected skill document request fails, even though the skills list loaded fine', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources();
    await Promise.resolve();
    fixture.detectChanges();

    fixture.componentInstance.select('testing-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/skills/testing-essentials'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('error-state')).not.toBeNull();
    expect(el.textContent).not.toContain('Decision table');
  });

  it('shows a stale-data notice when the last sync failed, even though the selected skill loaded fine', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources({
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: 'connection refused',
      stale: true,
    });
    await Promise.resolve();
    fixture.detectChanges();

    fixture.componentInstance.select('signals-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/skills/signals-essentials'))
      .flush({ name: 'signals-essentials', body: '## Decision table' });
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('stale-notice')).not.toBeNull();
    const text = el.textContent ?? '';
    expect(text).toContain('out of date');
    expect(text).toContain('connection refused');
    // The document itself loaded fine — this is the degraded state, not the
    // failed one, so the content still renders alongside the notice.
    expect(el.querySelector('md-view')).not.toBeNull();
  });

  it('never renders raw HTML from a skill document', async () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    drainRootResources();
    await Promise.resolve();
    fixture.detectChanges();

    fixture.componentInstance.select('angular-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/skills/angular-essentials'))
      .flush({ name: 'angular-essentials', body: 'Text with <img src=x onerror=alert(1)> inside' });
    await Promise.resolve();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });
});
