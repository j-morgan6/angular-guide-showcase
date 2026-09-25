import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ShowcaseApi } from './core/api/showcase-api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="brand">
        <strong>angular-guide</strong>
        <span class="tag">showcase</span>
      </div>
      <nav>
        <a routerLink="/rules" routerLinkActive="active">Rules</a>
        <a routerLink="/skills" routerLinkActive="active">Skills</a>
        <a routerLink="/activity" routerLinkActive="active">Activity</a>
      </nav>
    </header>

    <main>
      <router-outlet />
    </main>

    <footer>
      <p>
        Built under the enforcement of the plugin it displays. Reads
        <a href="https://github.com/j-morgan6/angular-guide" target="_blank" rel="noopener noreferrer">
          j-morgan6/angular-guide
        </a>
        through a Spring Boot backend that syncs from GitHub.
      </p>
      @if (api.isStale()) {
        <p class="limited">Backend sync data may be out of date — {{ api.syncError() ?? 'last sync failed' }}.</p>
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
}
