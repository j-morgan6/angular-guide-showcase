import { TestBed } from '@angular/core/testing';
import { DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Commit, Contributor, SyncStatus } from '../../core/api/showcase.types';
import ActivityPage from './activity-page';

const RULES_URL = '/api/plugins/spring-boot-guide/rules';
const SKILLS_URL = '/api/plugins/spring-boot-guide/skills';
const COMMITS_URL = '/api/plugins/spring-boot-guide/activity/commits';
const CONTRIBUTORS_URL = '/api/plugins/spring-boot-guide/activity/contributors';
const SYNC_STATUS_URL = '/api/sync/status';

// Full-length, not pre-truncated — the backend sends the whole sha.
const COMMITS_FIXTURE: Commit[] = [
  {
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    message: 'feat: thing',
    authorName: 'Joseph Morgan',
    authorAvatarUrl: 'https://avatars.example/1',
    url: 'https://github.com/x',
    authoredAt: '2026-09-07T00:00:00Z',
  },
];

const CONTRIBUTORS_FIXTURE: Contributor[] = [
  { login: 'j-morgan6', avatarUrl: 'https://avatars.example/1', url: 'https://github.com/j-morgan6', contributions: 41 },
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

describe('ActivityPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    http = TestBed.inject(HttpTestingController);
  });

  /** Drains the two `ShowcaseApi` resources this page doesn't primarily exercise. */
  function drainOtherEagerResources(syncStatus: SyncStatus = freshSyncStatus()): void {
    http.expectOne(RULES_URL).flush([]);
    http.expectOne(SKILLS_URL).flush([]);
    http.expectOne(SYNC_STATUS_URL).flush(syncStatus);
  }

  function flushActivity(commits: Commit[], contributors: Contributor[]): void {
    http.expectOne(COMMITS_URL).flush(commits);
    http.expectOne(CONTRIBUTORS_URL).flush(contributors);
  }

  it('renders commits with their short sha and no stale notice while fresh', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    drainOtherEagerResources();
    flushActivity(COMMITS_FIXTURE, CONTRIBUTORS_FIXTURE);
    await Promise.resolve();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('abcdef1');
    expect(text).not.toContain(COMMITS_FIXTURE[0].sha);
    expect(text).toContain('feat: thing');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('stale-notice'),
    ).toBeNull();
  });

  it('renders contributor cards once the deferred block is rendered', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    drainOtherEagerResources();
    flushActivity(COMMITS_FIXTURE, CONTRIBUTORS_FIXTURE);
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
   * Blocker 3 (Task 11 lineage): the deferred contributors block must have a
   * distinct failure branch rendering error-state, not silently fall back to
   * an empty grid indistinguishable from "no contributors".
   */
  it('renders error-state, not a silently-empty grid, when the contributors request fails', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    drainOtherEagerResources();
    http.expectOne(COMMITS_URL).flush([]);
    http.expectOne(CONTRIBUTORS_URL).flush('boom', {
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

  it('shows a stale-data notice above the commits when the last sync failed, even though everything loaded', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    drainOtherEagerResources({
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: 'connection refused',
      stale: true,
    });
    flushActivity(COMMITS_FIXTURE, CONTRIBUTORS_FIXTURE);
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('stale-notice')).not.toBeNull();
    const text = el.textContent ?? '';
    expect(text).toContain('out of date');
    expect(text).toContain('connection refused');
    // The commits themselves loaded fine — degraded, not failed, so the
    // list still renders alongside the notice.
    expect(el.querySelector('commit-list')).not.toBeNull();
    expect(el.querySelector('error-state')).toBeNull();
  });
});
