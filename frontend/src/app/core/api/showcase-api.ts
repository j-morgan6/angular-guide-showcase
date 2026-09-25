import { computed, signal, Service, type Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type {
  Commit,
  Contributor,
  PluginSummary,
  Rule,
  SkillDoc,
  SkillSummary,
  SyncStatus,
} from './showcase.types';

const API = '/api';

/** The slug the app opens on, and the fallback for an unrecognised one. */
export const DEFAULT_PLUGIN = 'angular-guide';

@Service()
export class ShowcaseApi {
  /**
   * Which plugin this dashboard is reporting on. The backend ingests and
   * serves both through the same API, so switching is a matter of changing
   * this slug — every resource below keys on it, so setting it refetches.
   *
   * Declared before the resources on purpose: field initializers run in
   * order, and they read it.
   */
  readonly plugin = signal(DEFAULT_PLUGIN);

  /**
   * Every plugin the backend serves. Not keyed on `plugin` — it is the list
   * you choose from, so it loads once and drives the header switcher.
   */
  readonly plugins = httpResource<PluginSummary[]>(() => `${API}/plugins`, {
    defaultValue: [],
  });

  /** The currently-selected plugin's metadata, once the list has loaded. */
  readonly currentPlugin: Signal<PluginSummary | undefined> = computed(() =>
    this.plugins.value().find((p) => p.slug === this.plugin()),
  );

  /**
   * Resources are created once at root scope, so navigating between routes
   * reuses them rather than refetching. The backend has no per-IP quota, so
   * this is now about latency rather than about staying inside a budget.
   */
  readonly rules = httpResource<Rule[]>(() => `${API}/plugins/${this.plugin()}/rules`, {
    defaultValue: [],
  });

  readonly skills = httpResource<SkillSummary[]>(() => `${API}/plugins/${this.plugin()}/skills`, {
    defaultValue: [],
  });

  readonly commits = httpResource<Commit[]>(
    () => `${API}/plugins/${this.plugin()}/activity/commits`,
    { defaultValue: [] },
  );

  readonly contributors = httpResource<Contributor[]>(
    () => `${API}/plugins/${this.plugin()}/activity/contributors`,
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
      return value ? `${API}/plugins/${this.plugin()}/skills/${value}` : undefined;
    });
  }
}
