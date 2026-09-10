import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GithubApi } from './github-api';

const REPO_URL = 'https://api.github.com/repos/j-morgan6/angular-guide';

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
});
