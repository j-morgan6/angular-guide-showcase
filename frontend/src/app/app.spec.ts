import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { ShowcaseApi } from './core/api/showcase-api';

describe('App routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('redirects the empty path to the default plugin', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/angular-guide/rules');
  });

  it('drives the api plugin signal from the route param', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/spring-boot-guide/rules');
    expect(TestBed.inject(ShowcaseApi).plugin()).toBe('spring-boot-guide');
  });

  it('switches the api plugin signal back when navigating to the other plugin', async () => {
    const harness = await RouterTestingHarness.create();
    const api = TestBed.inject(ShowcaseApi);

    await harness.navigateByUrl('/spring-boot-guide/skills');
    expect(api.plugin()).toBe('spring-boot-guide');

    await harness.navigateByUrl('/angular-guide/skills');
    expect(api.plugin()).toBe('angular-guide');
  });

  it('lazily loads every feature route', () => {
    const children = routes.flatMap((r) => r.children ?? []);
    const featureRoutes = children.filter((r) => r.path && r.path !== '**' && !r.redirectTo);
    expect(featureRoutes.length).toBeGreaterThan(0);
    for (const route of featureRoutes) {
      expect(route.loadComponent, `${route.path} must be lazy`).toBeDefined();
      expect((route as { component?: unknown }).component).toBeUndefined();
    }
  });

  it('renders a switcher entry for every plugin the backend serves', async () => {
    await TestBed.inject(Router).navigateByUrl('/angular-guide/rules');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/plugins').flush([
      { slug: 'angular-guide', name: 'angular-guide', repoFullName: 'j-morgan6/angular-guide', description: '', syncedAt: null, ruleCount: 30 },
      { slug: 'spring-boot-guide', name: 'spring-boot-guide', repoFullName: 'j-morgan6/spring-boot-guide', description: '', syncedAt: null, ruleCount: 39 },
    ]);
    http.match(() => true).forEach((r) => r.flush([]));
    await Promise.resolve();
    fixture.detectChanges();

    const slugs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-plugin]')].map(
      (el) => el.getAttribute('data-plugin'),
    );
    expect(slugs).toEqual(['angular-guide', 'spring-boot-guide']);
  });

  it('keeps you on the same section when switching plugins', async () => {
    await TestBed.inject(Router).navigateByUrl('/angular-guide/skills');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/plugins').flush([
      { slug: 'spring-boot-guide', name: 'spring-boot-guide', repoFullName: 'b', description: '', syncedAt: null, ruleCount: 39 },
    ]);
    http.match(() => true).forEach((r) => r.flush([]));
    await Promise.resolve();
    fixture.detectChanges();

    const spring = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-plugin="spring-boot-guide"]',
    );
    expect(spring?.getAttribute('href')).toBe('/spring-boot-guide/skills');
  });

  it('renders navigation links for all three routes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('nav a');
    expect(links).toHaveLength(3);
  });
});
