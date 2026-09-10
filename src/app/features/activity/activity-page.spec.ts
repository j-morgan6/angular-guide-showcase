import { TestBed } from '@angular/core/testing';
import { DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import ActivityPage from './activity-page';

const REPO_URL = 'https://api.github.com/repos/j-morgan6/angular-guide';

describe('ActivityPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    http = TestBed.inject(HttpTestingController);
  });

  function flushAll() {
    http
      .expectOne((r) => r.url === REPO_URL)
      .flush({ name: 'angular-guide', stargazers_count: 4, forks_count: 1, open_issues_count: 0, pushed_at: '2026-09-07T00:00:00Z', description: 'd' });
    http.expectOne((r) => r.url.includes('/commits')).flush([
      {
        sha: 'abcdef1234',
        html_url: 'https://github.com/x',
        commit: { message: 'feat: thing\n\nbody', author: { name: 'Joseph Morgan', date: '2026-09-07T00:00:00Z' } },
        author: { avatar_url: 'https://avatars.example/1' },
      },
    ]);
    http.expectOne((r) => r.url.includes('/contributors')).flush([
      { login: 'j-morgan6', avatar_url: 'https://avatars.example/1', contributions: 41, html_url: 'https://github.com/j-morgan6' },
    ]);
  }

  it('renders commits with their short sha and subject line only', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    await Promise.resolve();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('abcdef1');
    expect(text).toContain('feat: thing');
    expect(text).not.toContain('body');
  });

  it('renders contributor cards once the deferred block is rendered', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    fixture.detectChanges();

    const [block] = await fixture.getDeferBlocks();
    await block.render(DeferBlockState.Complete);
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('contributor-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('j-morgan6');
    expect(cards[0].textContent).toContain('41');
  });

  /**
   * Blocker 3: the deferred contributors block had only an isLoading branch
   * and an @else that rendered `api.contributors.value() ?? []` — a 403 or
   * 500 collapsed into the same empty grid as a repo with genuinely no
   * contributors, indistinguishable from each other. This test flushes the
   * contributors request with a failure and can only pass if the template
   * has a distinct failure branch rendering error-state; against the
   * pre-fix template it renders an empty `.contributors` grid with no
   * error-state and no failure text.
   */
  it('renders error-state, not a silently-empty grid, when the contributors request fails', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === REPO_URL)
      .flush({ name: 'angular-guide', stargazers_count: 4, forks_count: 1, open_issues_count: 0, pushed_at: '2026-09-07T00:00:00Z', description: 'd' });
    http.expectOne((r) => r.url.includes('/commits')).flush([]);
    http.expectOne((r) => r.url.includes('/contributors')).flush('boom', {
      status: 500,
      statusText: 'Server Error',
    });
    await Promise.resolve();
    fixture.detectChanges();

    const [block] = await fixture.getDeferBlocks();
    await block.render(DeferBlockState.Complete);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('error-state')).not.toBeNull();
    expect(el.querySelectorAll('contributor-card')).toHaveLength(0);
    expect(el.querySelector('.contributors')).toBeNull();
  });

  it('shows repo metadata as distinct stats, not just any digit on the page', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const stats = new Map<string, string>();
    el.querySelectorAll('.stats > div').forEach((row) => {
      const label = row.querySelector('dt')?.textContent?.trim() ?? '';
      const value = row.querySelector('dd')?.textContent?.trim() ?? '';
      stats.set(label, value);
    });

    expect(stats.get('Stars')).toBe('4');
    expect(stats.get('Forks')).toBe('1');
    expect(stats.get('Open issues')).toBe('0');
  });
});
