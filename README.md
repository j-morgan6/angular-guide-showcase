# angular-guide showcase

An Angular v22 dashboard for [`angular-guide`](https://github.com/j-morgan6/angular-guide),
the Claude Code plugin this app was built under. The app itself is the vehicle — it exists
to display the plugin's rules and skills against the plugin's own real source, live from
GitHub — but **[`docs/plugin-findings.md`](docs/plugin-findings.md) is the actual
deliverable**: a validation record of every rule the plugin fired (and several it didn't)
while building this project, and a closing verdict on whether the plugin was worth having.

- **Deployed (once `.github/workflows/deploy.yml` runs on `master`):**
  https://j-morgan6.github.io/angular-guide-showcase/
- **The plugin this app displays:** https://github.com/j-morgan6/angular-guide
- **The validation record:** [`docs/plugin-findings.md`](docs/plugin-findings.md)

## What it shows

Three routes, each lazily loaded (`loadComponent`, never `component:` — the plugin's
NG101 requires this, and `frontend/src/app/app.spec.ts` asserts it structurally so a future
eager route fails the test suite, not just the hook):

- **Rules** — the plugin's rule table, parsed live from its README.
- **Skills** — the plugin's nine skill documents, rendered from real markdown through a
  hand-written token renderer (no `[innerHTML]`, no `bypassSecurityTrustHtml` — NG014 bans
  both, and `frontend/src/app/ui/markdown/` composes real components from `marked`'s token
  tree instead).
- **Activity** — commits and contributors on the plugin's own repository.

## Local development

The repository is two independent halves: an Angular workspace in `frontend/` and a
Spring Boot workspace in `backend/`. Neither depends on the other to build or test —
the front end reads GitHub directly, and the backend (once running) reads GitHub
through a sync job into its own Postgres database. Nothing in this repository is
deployed today except the front end (see above); the backend is written, tested, and
buildable, and is meant to be run locally.

### Front end

```bash
cd frontend
npm install
npx ng serve
```

Then open `http://localhost:4200/`.

To run the test suite:

```bash
cd frontend
npx ng test --watch=false
```

(`ng test` alone runs in watch mode and will hang a non-interactive shell; there is no
`--run` flag on this toolchain's Vitest builder — see the BG004 entries in
`docs/plugin-findings.md`.)

### Backend

The backend needs Postgres. `backend/compose.yaml` starts it:

```bash
cd backend
docker compose up postgres
```

Then, **in your own terminal** (not from an agent session — `spring-boot:run` never
exits, so an agent that runs it there hangs; see the BG004 entries in
`docs/spring-plugin-findings.md`):

```bash
cd backend
./mvnw spring-boot:run
```

The app comes up on `http://localhost:8080/`. `GITHUB_TOKEN` is optional — set it in
your environment before running to raise GitHub's unauthenticated rate limit
(60 requests/hour) during the sync job; without it, sync still works, just at that
lower ceiling.

To run the backend's own test suite (uses Testcontainers, so Docker must be running):

```bash
cd backend
./mvnw -B verify
```

`backend/compose.yaml` also defines an `app` service that builds and runs the whole
stack (`docker compose up`), but this project deliberately never runs it: writing and
building the image is what this repository validates, not deploying it. See
`docs/spring-plugin-findings.md` for the deployment-configuration findings.

## Live data, unauthenticated

Every route reads the GitHub REST API directly from the browser with no token, which caps
this app — and every visitor sharing an IP with it — at **60 requests per hour**. Resources
are created once at root scope (`GithubApi`, `@Service()`) and reused across navigation, so
a normal browsing session stays well inside that budget without a manual cache.

If the limit is hit, the footer shows a "GitHub rate limit reached" notice and each affected
section — including `/activity`'s deferred contributors block and `/skills`'s per-skill
document, not just the four root resources — renders `error-state` with a rate-limit
explanation and, when GitHub's `x-ratelimit-reset` header is present, the local time it
resets at, instead of a generic failure message. The two are deliberately distinct, since a
rate-limited user needs to know to wait, not to retry harder.

## Why this exists

This project was built to validate `angular-guide` against real code, not to demonstrate
Angular technique for its own sake. `docs/plugin-findings.md` is the log of every hook
firing encountered while building it — true positives, false positives, and the rules that
stayed silent on correct code — plus a closing synthesis on whether the plugin, on net,
caught more real mistakes than it cost in friction.
