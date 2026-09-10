# angular-guide-showcase — Design

**Date:** 2026-09-10
**Status:** Approved, ready for implementation planning
**Repo:** `github.com/j-morgan6/angular-guide-showcase`
**Validates:** `github.com/j-morgan6/angular-guide` @ `c46a00a`

## 1. Purpose

An Angular v22 dashboard, built entirely under `angular-guide`'s enforcement, that
displays the plugin it was built by.

It serves two ends at once:

1. **The showcase.** A working application demonstrating what the plugin produces,
   with its commit history and hook transcripts as evidence.
2. **The validation.** `angular-guide` ships 159 passing assertions, all of which run
   against synthetic fixture workspaces built by its own test harness. It has never
   been exercised against real code. Real code is where false positives live, and a
   blocking rule that rejects correct work is the failure mode most likely to get an
   enforcement plugin uninstalled.

The second purpose is the reason to build it. The first is what makes it worth keeping.

## 2. Context

`angular-guide` enforces modern Angular through 30 hook rules — BG001–BG006 on Bash,
NG001–NG018 blocking on Write/Edit, NG101–NG106 advisory — gated on a workspace profile
that `detect_project.sh` derives from `angular.json` and `package.json`. Nine skills
supply the judgment the rules cannot encode.

The plugin will be installed the way any user installs it:

```
/plugin marketplace add j-morgan6/angular-guide
```

Not symlinked, not path-overridden. Validating the real install path is part of the
exercise.

## 3. Non-goals

- Not a product. No accounts, no persistence, no backend.
- Not a documentation site for the plugin — the plugin's own README owns that.
- No authentication. A GitHub token in a browser bundle is exactly what NG016 blocks,
  and shipping one would be wrong regardless of the rule.
- Not a demonstration of every rule. Rules that only fire on bad code (NG002 `@NgModule`,
  NG011 `.mutate()`) will never trigger here, and deliberately writing bad code to make
  them fire would defeat the purpose: false positives only surface while writing code
  you believe is correct.

## 4. Architecture

Angular v22, standalone, zoneless, signals-first, Vitest, deployed to GitHub Pages.

Three lazily-loaded routes:

| Route | Content | Rules it exercises |
|---|---|---|
| `/rules` | The 30 rules — list, filter by severity and version gate, detail view | `httpResource`, `computed` filtering, signal inputs, NG101 |
| `/skills` | The nine `SKILL.md` documents, rendered | **NG014**, NG106 |
| `/activity` | Commits, contributors, assertion count over time | `NgOptimizedImage`, `@defer`, error states |

Everything is read live from the plugin's own repository through the GitHub API. Rules
are parsed from the README's three rule tables; skills from the `SKILL.md` files. When
the plugin gains a rule, the dashboard shows it without a redeploy. Nothing about the
plugin is duplicated into this repo — the same principle that governs the plugin's
relationship to Angular's official documentation.

### Layering

- **`core/github/`** — one service wrapping the GitHub API. Exposes `httpResource`s
  keyed on signals. The only place that knows about base64 decoding, rate-limit headers,
  or `sessionStorage` caching.
- **`core/parsing/`** — pure functions. README markdown → `Rule[]`; markdown → token
  tree. No Angular dependencies, no injection; trivially unit-testable.
- **`features/rules/`, `features/skills/`, `features/activity/`** — one container
  component per route that orchestrates, with presentational children that take inputs
  and emit outputs.
- **`ui/markdown/`** — the token renderer (§5), shared by `/skills` and `/rules`.

## 5. Rendering markdown without `innerHTML`

NG014 blocks `[innerHTML]` outright and offers no escape hatch. Its fix text says to
compose real components. This design does exactly that:

```
marked.lexer(src) → Token[] → <md-view [tokens]> → @switch (token.type)
                                                     ├─ heading    → <md-heading>
                                                     ├─ code       → <md-code>
                                                     ├─ table      → <md-table>
                                                     ├─ list       → <md-list>
                                                     └─ paragraph  → <md-view>  (recursive)
```

`marked.lexer()` returns a structured token tree; `marked.parser()` — the step that
would produce an HTML string — is never called. No HTML string is ever constructed, so
there is nothing to sanitize and the XSS class is structurally absent rather than
defended against. Code blocks become a real component, so syntax highlighting is
component logic rather than a regex over a string.

**This is the design's principal claim, and it is falsifiable.** If rendering nine real
skill documents this way proves painful, that is evidence NG014 is too absolute and
should be advisory rather than blocking. Either outcome is a genuine finding about the
plugin, which is the point of building this.

Unsupported token types render as escaped text rather than being dropped, so an
unhandled construct degrades visibly instead of silently vanishing.

## 6. Data and rate limits

The GitHub API allows 60 requests per hour unauthenticated, shared per IP. A public
demo will reach that. Mitigations, in order of effect:

- One `httpResource` per resource, keyed on signals, so navigation does not refetch.
- A `sessionStorage` cache, so a session costs roughly four requests rather than four
  per view.
- `X-RateLimit-Remaining` is read and surfaced. On a 403 with zero remaining, the UI
  shows an explicit "rate limited, resets at HH:MM" state.

Four endpoints are used:

| Endpoint | For |
|---|---|
| `GET /repos/j-morgan6/angular-guide` | Repository metadata |
| `GET /repos/j-morgan6/angular-guide/contents/{path}` | README and `SKILL.md` files (base64) |
| `GET /repos/j-morgan6/angular-guide/commits` | Activity feed |
| `GET /repos/j-morgan6/angular-guide/contributors` | Contributor avatars |

## 7. Error handling

Every view renders from `httpResource`'s `.value()`, `.isLoading()`, and `.error()`.
Three states are distinguished rather than collapsed:

- **Loading** — skeleton, not a spinner.
- **Rate limited** — explicit, with the reset time.
- **Failed** — the actual failure, with a retry.

Collapsing these into one generic error is the sloppiness the `data-loading` skill warns
about; distinguishing them is a small demonstration that the guidance is worth following.

Parsing failures are handled separately from transport failures. If the README's rule
tables change shape, `/rules` shows a parse error naming what it expected — a live parse
of someone else's document is a real dependency and should fail legibly.

## 8. Testing

Vitest with `provideHttpClientTesting`. Weighting:

- **Heaviest — `core/parsing/`.** Pure functions, the novel logic, no framework
  involvement. The token renderer and the README rule parser carry the most tests.
- **Moderate — containers.** Loading, rate-limited, failed, and empty states per route,
  asserted through the rendered template rather than by calling methods.
- **Light — presentational components.** Component harnesses for filter interactions.
- **None** — that inputs bind or outputs emit. That is Angular's test, not ours.

## 9. The findings log

`docs/plugin-findings.md`, maintained during the build. One entry per hook firing:

```markdown
### NG104 — src/app/features/activity/contributor-card.html:12
**Code:** `<img [src]="contributor().avatarUrl" alt="...">`
**Verdict:** false positive
**Why:** a bound `[src]` is not a static image; NgOptimizedImage's `ngSrc` requires
known dimensions, which a GitHub avatar URL does not carry.
**Action:** narrow NG104 to literal `src="..."` only.
```

Also recorded: rules that *should* have fired and did not, and any point where a skill's
advice conflicted with what the code actually needed.

This log is the deliverable that feeds `angular-guide` v1.1. The application is the
vehicle; the log is the finding.

## 10. Deployment

GitHub Pages via GitHub Actions on push to `master`. `ng build` with the base href set
for the project path. No secrets in the workflow — the app makes only unauthenticated
requests.

## 11. Success criteria

1. The application builds, deploys, and renders all three routes against live data.
2. Every hook firing during the build is recorded and triaged in the findings log.
3. The log yields a concrete, prioritized fix list for `angular-guide` v1.1 — or states
   plainly that no changes are warranted, which is an equally valid result.
4. A verdict on NG014: workable as a blocking rule, or in need of demotion to advisory.
