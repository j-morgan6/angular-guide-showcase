import { computed, Service, type Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type {
  Commit,
  Contributor,
  Rule,
  SkillDoc,
  SkillSummary,
  SyncStatus,
} from './showcase.types';

/**
 * The plugin this dashboard reports on. The backend ingests and serves both
 * angular-guide and spring-boot-guide through the same API — only this UI
 * surfaces one at a time, and every piece of surrounding copy (header,
 * footer, route titles, the rules-page lede) names angular-guide. A plugin
 * switcher that lets the UI show either is the real follow-up.
 */
const PLUGIN = 'angular-guide';
const API = '/api';

@Service()
export class ShowcaseApi {
  /**
   * Resources are created once at root scope, so navigating between routes
   * reuses them rather than refetching. The backend has no per-IP quota, so
   * this is now about latency rather than about staying inside a budget.
   */
  readonly rules = httpResource<Rule[]>(() => `${API}/plugins/${PLUGIN}/rules`, {
    defaultValue: [],
  });

  readonly skills = httpResource<SkillSummary[]>(() => `${API}/plugins/${PLUGIN}/skills`, {
    defaultValue: [],
  });

  readonly commits = httpResource<Commit[]>(() => `${API}/plugins/${PLUGIN}/activity/commits`, {
    defaultValue: [],
  });

  readonly contributors = httpResource<Contributor[]>(
    () => `${API}/plugins/${PLUGIN}/activity/contributors`,
    { defaultValue: [] },
  );

  readonly syncStatus = httpResource<SyncStatus>(() => `${API}/sync/status`);

  /**
   * True when the backend's data is not fresh — the last sync failed, or
   * finished longer ago than the sync interval allows. This replaces the
   * rate-limit signal: the browser no longer talks to GitHub, so a quota is
   * no longer a state this app can be in.
   */
  readonly isStale: Signal<boolean> = computed(() => this.syncStatus.value()?.stale ?? false);

  /** The error from the last failed sync, when there is one. */
  readonly syncError: Signal<string | undefined> = computed(
    () => this.syncStatus.value()?.error ?? undefined,
  );

  /**
   * One skill document, keyed on a signal so it refetches on change. Called
   * from a field initializer or constructor only — `httpResource` needs an
   * injection context unless given an explicit injector.
   */
  skillDoc(name: Signal<string | undefined>) {
    return httpResource<SkillDoc>(() => {
      const value = name();
      return value ? `${API}/plugins/${PLUGIN}/skills/${value}` : undefined;
    });
  }
}
