import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ShowcaseApi } from './showcase-api';

describe('ShowcaseApi', () => {
  let api: ShowcaseApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ShowcaseApi],
    });
    api = TestBed.inject(ShowcaseApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * `ShowcaseApi` creates five resources eagerly at construction — rules,
   * skills, commits, contributors and syncStatus — so every test must drain
   * all five or `http.verify()` in afterEach fails on the ones left open.
   */
  function flushOtherEagerResources(): void {
    http.expectOne('/api/plugins').flush([]);
    http.expectOne('/api/plugins/angular-guide/skills').flush([]);
    http.expectOne('/api/plugins/angular-guide/activity/commits').flush([]);
    http.expectOne('/api/plugins/angular-guide/activity/contributors').flush([]);
  }

  it('requests rules from the backend, not from GitHub', async () => {
    TestBed.tick();
    const req = http.expectOne('/api/plugins/angular-guide/rules');
    expect(req.request.method).toBe('GET');
    expect(req.request.url).not.toContain('api.github.com');

    req.flush([{ ruleId: 'NG101', kind: 'blocking', trigger: 'eager route', fix: 'loadComponent', gate: 'none' }]);
    flushOtherEagerResources();
    http.expectOne('/api/sync/status').flush({
      status: 'never',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: null,
      stale: false,
    });
    await Promise.resolve();

    expect(api.rules.value().map((r) => r.ruleId)).toEqual(['NG101']);
  });

  it('defaults to angular-guide', () => {
    expect(api.plugin()).toBe('angular-guide');
  });

  it('refetches every resource against the new slug when the plugin changes', async () => {
    TestBed.tick();
    http.expectOne('/api/plugins/angular-guide/rules').flush([]);
    flushOtherEagerResources();
    http.expectOne('/api/sync/status').flush({
      status: 'succeeded',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 30,
      error: null,
      stale: false,
    });
    await Promise.resolve();

    api.plugin.set('spring-boot-guide');
    TestBed.tick();

    http
      .expectOne('/api/plugins/spring-boot-guide/rules')
      .flush([{ ruleId: 'SB005', kind: 'blocking', trigger: 'eager fetch', fix: 'use LAZY', gate: 'none' }]);
    http.expectOne('/api/plugins/spring-boot-guide/skills').flush([]);
    http.expectOne('/api/plugins/spring-boot-guide/activity/commits').flush([]);
    http.expectOne('/api/plugins/spring-boot-guide/activity/contributors').flush([]);
    await Promise.resolve();

    expect(api.rules.value().map((r) => r.ruleId)).toEqual(['SB005']);
  });

  it('reports stale when the sync status says so', async () => {
    TestBed.tick();
    http.expectOne('/api/plugins/angular-guide/rules').flush([]);
    flushOtherEagerResources();
    http.expectOne('/api/sync/status').flush({
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: 'connection refused',
      stale: true,
    });
    await Promise.resolve();
    expect(api.isStale()).toBe(true);
  });
});
