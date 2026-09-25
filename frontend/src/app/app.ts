import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ShowcaseApi } from './core/api/showcase-api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="brand">
        <strong>{{ api.plugin() }}</strong>
        <span class="tag">showcase</span>
      </div>

      <div class="switcher" role="group" aria-label="Plugin">
        @for (p of api.plugins.value(); track p.slug) {
          <a
            [attr.data-plugin]="p.slug"
            [routerLink]="['/', p.slug, section()]"
            [class.active]="p.slug === api.plugin()"
            [attr.aria-current]="p.slug === api.plugin() ? 'true' : null"
          >
            {{ p.slug }}
            <span class="count">{{ p.ruleCount }}</span>
          </a>
        }
      </div>

      <nav>
        <a [routerLink]="['/', api.plugin(), 'rules']" routerLinkActive="active">Rules</a>
        <a [routerLink]="['/', api.plugin(), 'skills']" routerLinkActive="active">Skills</a>
        <a [routerLink]="['/', api.plugin(), 'activity']" routerLinkActive="active">Activity</a>
      </nav>
    </header>

    <main>
      <router-outlet />
    </main>

    <footer>
      <p>
        Built under the enforcement of the plugins it displays. Reads
        @if (api.currentPlugin(); as plugin) {
          <a
            [href]="'https://github.com/' + plugin.repoFullName"
            target="_blank"
            rel="noopener noreferrer"
            >{{ plugin.repoFullName }}</a
          >
        } @else {
          <span>both plugin repositories</span>
        }
        through a Spring Boot backend that syncs from GitHub.
      </p>
      @if (api.isStale()) {
        <p class="limited">
          Backend sync data may be out of date — {{ api.syncError() ?? 'last sync failed' }}.
        </p>
      }
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: baseline; gap: 0.5rem; }
    .tag { color: var(--text-2); font-size: 0.8rem; }
    .switcher { display: flex; gap: 0.25rem; padding: 0.2rem; border-radius: 8px; background: var(--surface-2); }
    .switcher a {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.3rem 0.65rem; border-radius: 6px;
      text-decoration: none; color: var(--text-2); font-size: 0.85rem;
    }
    .switcher a:hover { color: var(--text-1); }
    .switcher a.active { background: var(--surface-1); color: var(--text-1); font-weight: 600; }
    .switcher .count {
      font-size: 0.7rem; padding: 0.05rem 0.35rem; border-radius: 999px;
      background: var(--surface-3); color: var(--text-2);
    }
    nav { display: flex; gap: 0.35rem; }
    nav a {
      padding: 0.35rem 0.7rem; border-radius: 6px;
      text-decoration: none; color: var(--text-2); font-size: 0.9rem;
    }
    nav a:hover { background: var(--surface-2); color: var(--text-1); }
    nav a.active { background: var(--surface-3); color: var(--text-1); font-weight: 600; }
    main { flex: 1; width: 100%; max-width: 72rem; margin: 0 auto; padding: 2rem 1.5rem; }
    footer {
      padding: 1.5rem; border-top: 1px solid var(--border);
      color: var(--text-2); font-size: 0.85rem; text-align: center;
    }
    footer a { color: inherit; }
    .limited { color: var(--warn); }
  `,
})
export class App {
  protected readonly api = inject(ShowcaseApi);
  private readonly router = inject(Router);

  /**
   * The current URL as a signal. `toSignal` at the boundary rather than a
   * manual subscribe: the router is the one genuinely stream-shaped input
   * here, and everything downstream of it is a plain `computed`.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Which section is open — "rules", "skills" or "activity". The switcher
   * links target the same section under the other plugin, so changing plugin
   * keeps you where you were instead of dropping you back on rules.
   */
  protected readonly section = computed(
    () => this.url().split('?')[0].split('/').filter(Boolean)[1] ?? 'rules',
  );
}
