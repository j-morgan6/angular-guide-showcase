import { computed, Service, type Signal } from '@angular/core';
import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { decodeBase64 } from '../parsing/base64';
import type { Commit, Contributor, RepoMeta } from './github.types';

const REPO = 'j-morgan6/angular-guide';
const API = 'https://api.github.com';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * True when a resource failed with GitHub's rate-limit signature: a 403 whose
 * `x-ratelimit-remaining` header is zero. An ordinary 403 or a 500 is not
 * rate limiting, and conflating them would produce a misleading message.
 *
 * Exported so any resource created outside this service — a per-skill
 * document, for instance — can be folded into the same check instead of a
 * second, drifting copy of this condition.
 */
export function isRateLimitedResource(res: HttpResourceRef<unknown>): boolean {
  return res.statusCode() === 403 && res.headers()?.get('x-ratelimit-remaining') === '0';
}

/**
 * The Unix-epoch seconds at which a rate-limited resource's quota resets, per
 * `x-ratelimit-reset`. Returns undefined when the resource isn't rate limited
 * or the header is missing/unparseable, so callers fall back to vaguer
 * copy rather than rendering `Invalid Date`.
 */
export function rateLimitResetOf(res: HttpResourceRef<unknown>): number | undefined {
  if (!isRateLimitedResource(res)) {
    return undefined;
  }
  const header = res.headers()?.get('x-ratelimit-reset');
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

@Service()
export class GithubApi {
  /**
   * Resources are created once at root scope, so navigating between routes
   * reuses them instead of refetching. That keeps a session inside GitHub's
   * 60-requests-per-hour unauthenticated budget without a manual cache.
   */
  readonly repo = httpResource<RepoMeta>(() => `${API}/repos/${REPO}`, {
    parse: (raw: unknown): RepoMeta => {
      const r = asRecord(raw);
      return {
        name: str(r['name']),
        description: str(r['description']),
        stars: num(r['stargazers_count']),
        forks: num(r['forks_count']),
        openIssues: num(r['open_issues_count']),
        pushedAt: str(r['pushed_at']),
      };
    },
  });

  readonly commits = httpResource<Commit[]>(() => `${API}/repos/${REPO}/commits?per_page=30`, {
    parse: (raw: unknown): Commit[] => {
      if (!Array.isArray(raw)) {
        return [];
      }
      return raw.map((entry) => {
        const e = asRecord(entry);
        const commit = asRecord(e['commit']);
        const author = asRecord(commit['author']);
        const ghAuthor = asRecord(e['author']);
        return {
          sha: str(e['sha']).slice(0, 7),
          message: str(commit['message']).split('\n')[0],
          authorName: str(author['name']),
          authorAvatarUrl: str(ghAuthor['avatar_url']),
          date: str(author['date']),
          url: str(e['html_url']),
        };
      });
    },
  });

  readonly contributors = httpResource<Contributor[]>(() => `${API}/repos/${REPO}/contributors`, {
    parse: (raw: unknown): Contributor[] => {
      if (!Array.isArray(raw)) {
        return [];
      }
      return raw.map((entry) => {
        const c = asRecord(entry);
        return {
          login: str(c['login']),
          avatarUrl: str(c['avatar_url']),
          contributions: num(c['contributions']),
          url: str(c['html_url']),
        };
      });
    },
  });

  readonly readme = httpResource<string>(() => `${API}/repos/${REPO}/contents/README.md`, {
    parse: (raw: unknown) => decodeBase64(str(asRecord(raw)['content'])),
  });

  /**
   * The four root resources. `isRateLimited`/`rateLimitResetAt` fold over
   * exactly this list — a per-skill document created by `skillDoc()` is not
   * a member, so callers holding one must OR it in themselves via the
   * exported `isRateLimitedResource`/`rateLimitResetOf` helpers.
   */
  private readonly rootResources: readonly HttpResourceRef<unknown>[] = [
    this.repo,
    this.commits,
    this.contributors,
    this.readme,
  ];

  /**
   * True when any root resource failed with GitHub's rate-limit signature.
   *
   * Driven off `statusCode()`/`headers()` rather than digging into `error()`:
   * `HttpResourceImpl`'s error handler (`@angular/common/http`) sets both
   * signals from the `HttpErrorResponse` before it sends the error, so they
   * are populated at the same time `error()` is.
   */
  readonly isRateLimited: Signal<boolean> = computed(() =>
    this.rootResources.some(isRateLimitedResource),
  );

  /**
   * The Unix-epoch seconds at which the rate limit resets, from whichever
   * root resource actually hit it — undefined when nothing is rate limited
   * or none of the rate-limited responses carried a parseable
   * `x-ratelimit-reset` header.
   */
  readonly rateLimitResetAt: Signal<number | undefined> = computed(() => {
    for (const res of this.rootResources) {
      const reset = rateLimitResetOf(res);
      if (reset !== undefined) {
        return reset;
      }
    }
    return undefined;
  });

  /**
   * A single skill document, keyed on a signal so the resource refetches on
   * change. `httpResource` requires an injection context unless given an
   * explicit `injector` — safe here only because this is called from a field
   * initializer or constructor (both run inside one), never from a plain
   * method body invoked later.
   */
  skillDoc(name: Signal<string | undefined>) {
    return httpResource<string>(
      () => {
        const value = name();
        return value ? `${API}/repos/${REPO}/contents/skills/${value}/SKILL.md` : undefined;
      },
      { parse: (raw: unknown) => decodeBase64(str(asRecord(raw)['content'])) },
    );
  }
}
