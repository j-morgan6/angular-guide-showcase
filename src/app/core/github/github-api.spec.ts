import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GithubApi, isRateLimitedResource, rateLimitResetOf } from './github-api';

const REPO_URL = 'https://api.github.com/repos/j-morgan6/angular-guide';
const COMMITS_URL = 'https://api.github.com/repos/j-morgan6/angular-guide/commits?per_page=30';
const CONTRIBUTORS_URL = 'https://api.github.com/repos/j-morgan6/angular-guide/contributors';

describe('GithubApi', () => {
  let api: GithubApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GithubApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * All four resources are created as field initializers with no signal
   * dependency, so they start loading the moment the service is injected —
   * not only when a caller reads `.value()`. Every test flushes all four so
   * `http.verify()` doesn't see the other three still outstanding: this
   * picks the one it cares about by predicate, then flushes the rest with a
   * harmless body.
   */
  function takeAndDrainRest(where: (req: TestRequest) => boolean): TestRequest {
    TestBed.tick();
    const requests = http.match(() => true);
    const target = requests.find(where)!;
    requests.filter((r) => r !== target).forEach((r) => r.flush({}));
    return target;
  }

  it('requests repo metadata from the angular-guide repo', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    expect(req.request.method).toBe('GET');
    req.flush({
      name: 'angular-guide',
      description: 'Enforce modern Angular',
      stargazers_count: 3,
      forks_count: 1,
      open_issues_count: 0,
      pushed_at: '2026-09-07T00:00:00Z',
    });
    await Promise.resolve();
    expect(api.repo.value()).toMatchObject({ name: 'angular-guide', stars: 3 });
  });

  it('sends no Authorization header — the app is unauthenticated by design', () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('decodes README content from base64', async () => {
    const req = takeAndDrainRest((r) => r.request.url.includes('/contents/README.md'));
    req.flush({ content: btoa('# Hello'), encoding: 'base64' });
    await Promise.resolve();
    expect(api.readme.value()).toBe('# Hello');
  });

  it('parses commits, keeping the top-level author separate from the commit author, and surviving a null author', async () => {
    const req = takeAndDrainRest((r) => r.request.url === COMMITS_URL);
    req.flush([
      {
        sha: 'abc1234567890def1234567890abcdef12345678',
        commit: {
          message: 'Add rate-limit detection\n\nLonger body explaining why.',
          author: { name: 'Ada Lovelace', date: '2026-09-07T12:00:00Z' },
        },
        author: { login: 'ada', avatar_url: 'https://avatars.example.com/ada.png' },
        html_url: 'https://github.com/j-morgan6/angular-guide/commit/abc1234567890def1234567890abcdef12345678',
      },
      {
        // GitHub sends `author: null` when the commit's email isn't linked to any
        // GitHub account — the common real-world case this narrowing exists for.
        sha: 'def4567890abc1234567890def1234567890abcdef',
        commit: {
          message: 'Fix typo',
          author: { name: 'Grace Hopper', date: '2026-09-06T08:30:00Z' },
        },
        author: null,
        html_url: 'https://github.com/j-morgan6/angular-guide/commit/def4567890abc1234567890def1234567890abcdef',
      },
    ]);
    await Promise.resolve();

    const commits = api.commits.value();
    expect(commits?.[0]).toEqual({
      sha: 'abc1234',
      message: 'Add rate-limit detection',
      authorName: 'Ada Lovelace',
      authorAvatarUrl: 'https://avatars.example.com/ada.png',
      date: '2026-09-07T12:00:00Z',
      url: 'https://github.com/j-morgan6/angular-guide/commit/abc1234567890def1234567890abcdef12345678',
    });
    expect(commits?.[1]).toEqual({
      sha: 'def4567',
      message: 'Fix typo',
      authorName: 'Grace Hopper',
      authorAvatarUrl: '',
      date: '2026-09-06T08:30:00Z',
      url: 'https://github.com/j-morgan6/angular-guide/commit/def4567890abc1234567890def1234567890abcdef',
    });
  });

  it('parses contributors', async () => {
    const req = takeAndDrainRest((r) => r.request.url === CONTRIBUTORS_URL);
    req.flush([
      {
        login: 'ada',
        avatar_url: 'https://avatars.example.com/ada.png',
        contributions: 42,
        html_url: 'https://github.com/ada',
      },
    ]);
    await Promise.resolve();

    expect(api.contributors.value()).toEqual([
      {
        login: 'ada',
        avatarUrl: 'https://avatars.example.com/ada.png',
        contributions: 42,
        url: 'https://github.com/ada',
      },
    ]);
  });

  it('reports rate limiting when a 403 carries zero remaining', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    req.flush('rate limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0' },
    });
    await Promise.resolve();
    expect(api.isRateLimited()).toBe(true);
  });

  it('does not report rate limiting for an ordinary failure', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    await Promise.resolve();
    expect(api.isRateLimited()).toBe(false);
  });

  it('exposes the reset time from x-ratelimit-reset when a resource is rate limited', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    req.flush('rate limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1234567890' },
    });
    await Promise.resolve();
    expect(api.rateLimitResetAt()).toBe(1234567890);
  });

  it('leaves the reset time undefined when the header is missing', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    req.flush('rate limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0' },
    });
    await Promise.resolve();
    expect(api.rateLimitResetAt()).toBeUndefined();
  });

  it('leaves the reset time undefined when the header is present but unparseable', async () => {
    const req = takeAndDrainRest((r) => r.request.url === REPO_URL);
    req.flush('rate limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' },
    });
    await Promise.resolve();
    expect(api.rateLimitResetAt()).toBeUndefined();
  });
});

describe('isRateLimitedResource / rateLimitResetOf (exported helpers)', () => {
  /**
   * A minimal stand-in for HttpResourceRef, exercising only the two signals
   * the helpers read. Confirms the predicate and reset-parser are usable on
   * a resource GithubApi never created itself — the whole point of
   * exporting them (blocker 2: SkillsPage's per-skill `doc` resource).
   */
  function fakeResource(statusCode: number | undefined, headers: Record<string, string>) {
    return {
      statusCode: () => statusCode,
      headers: () => ({ get: (name: string) => headers[name] ?? null }),
    } as unknown as Parameters<typeof isRateLimitedResource>[0];
  }

  it('is true only for a 403 with zero remaining', () => {
    expect(isRateLimitedResource(fakeResource(403, { 'x-ratelimit-remaining': '0' }))).toBe(true);
    expect(isRateLimitedResource(fakeResource(403, { 'x-ratelimit-remaining': '5' }))).toBe(false);
    expect(isRateLimitedResource(fakeResource(500, { 'x-ratelimit-remaining': '0' }))).toBe(false);
    expect(isRateLimitedResource(fakeResource(undefined, {}))).toBe(false);
  });

  it('parses the reset header only when the resource is actually rate limited', () => {
    const limited = fakeResource(403, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '42',
    });
    expect(rateLimitResetOf(limited)).toBe(42);

    const notLimited = fakeResource(500, { 'x-ratelimit-reset': '42' });
    expect(rateLimitResetOf(notLimited)).toBeUndefined();
  });
});
