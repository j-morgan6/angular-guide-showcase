import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, CanActivateFn, ResolveFn, Routes } from '@angular/router';
import { DEFAULT_PLUGIN, ShowcaseApi } from './core/api/showcase-api';

/** The `:plugin` param, which lives on the parent route rather than the leaf. */
function pluginOf(route: ActivatedRouteSnapshot): string {
  return route.paramMap.get('plugin') ?? route.parent?.paramMap.get('plugin') ?? DEFAULT_PLUGIN;
}

/**
 * Pushes the `:plugin` route param into `ShowcaseApi`, which every resource
 * keys on. A guard rather than component code, so it runs before the routed
 * component loads and the first fetch already uses the right slug.
 */
const syncPlugin: CanActivateFn = (route) => {
  inject(ShowcaseApi).plugin.set(pluginOf(route));
  return true;
};

/** Titles name the plugin being viewed, rather than hardcoding one. */
function titleFor(page: string): ResolveFn<string> {
  return (route) => `${page} — ${pluginOf(route)}`;
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: `/${DEFAULT_PLUGIN}/rules` },
  {
    path: ':plugin',
    canActivate: [syncPlugin],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'rules' },
      {
        path: 'rules',
        title: titleFor('Rules'),
        loadComponent: () => import('./features/rules/rules-page'),
      },
      {
        path: 'skills',
        title: titleFor('Skills'),
        loadComponent: () => import('./features/skills/skills-page'),
      },
      {
        path: 'activity',
        title: titleFor('Activity'),
        loadComponent: () => import('./features/activity/activity-page'),
      },
    ],
  },
  { path: '**', redirectTo: `/${DEFAULT_PLUGIN}/rules` },
];
