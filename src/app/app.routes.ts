import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'rules' },
  {
    path: 'rules',
    title: 'Rules — angular-guide',
    loadComponent: () => import('./features/rules/rules-page'),
  },
  {
    path: 'skills',
    title: 'Skills — angular-guide',
    loadComponent: () => import('./features/skills/skills-page'),
  },
  {
    path: 'activity',
    title: 'Activity — angular-guide',
    loadComponent: () => import('./features/activity/activity-page'),
  },
  { path: '**', redirectTo: 'rules' },
];
