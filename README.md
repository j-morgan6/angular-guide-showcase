# angular-guide showcase

An Angular v22 dashboard, backed by a Spring Boot 4.1 API, for
[`angular-guide`](https://github.com/j-morgan6/angular-guide), the Claude Code plugin this app
was built under. The app itself is the vehicle — it exists to display the plugin's rules and
skills against the plugin's own real source — but
**[`docs/plugin-findings.md`](docs/plugin-findings.md)** and
**[`docs/spring-plugin-findings.md`](docs/spring-plugin-findings.md)** are the actual
deliverables: validation records of every rule each plugin fired (and several it didn't) while
building this project, and a closing verdict on whether each plugin was worth having.

- **The plugin this app displays:** https://github.com/j-morgan6/angular-guide
- **The validation records:** [`docs/plugin-findings.md`](docs/plugin-findings.md) (angular-guide)
  and [`docs/spring-plugin-findings.md`](docs/spring-plugin-findings.md) (spring-boot-guide)

This project is deployable, not deployed: both halves build, test, and run, but nothing in this
repository is hosted anywhere today. See "Local development" below to run it yourself.

## What it shows

Three routes, each lazily loaded (`loadComponent`, never `component:` — the plugin's
NG101 requires this, and `frontend/src/app/app.spec.ts` asserts it structurally so a future
eager route fails the test suite, not just the hook):

- **Rules** — the plugin's rule table, ingested by the backend from its README and served
  from Postgres.
- **Skills** — the plugin's nine skill documents, rendered from real markdown through a
  hand-written token renderer (no `[innerHTML]`, no `bypassSecurityTrustHtml` — NG014 bans
  both, and `frontend/src/app/ui/markdown/` composes real components from `marked`'s token
  tree instead).
- **Activity** — commits and contributors on the plugin's own repository.

## How it's built

The repository is two halves that run independently but together form the app:

- **`backend/`** — a Spring Boot 4.1 service that periodically syncs two Claude Code plugin
  repositories (`angular-guide` and `spring-boot-guide`) from the GitHub REST API into its own
  Postgres database, then serves that data through a read-only REST API
  (`/api/plugins/{slug}/rules`, `/skills`, `/activity/commits`, `/activity/contributors`, and
  `/api/sync/status`). Ingestion runs on a schedule (`github.sync-interval` in
  `application.yml`, default every 6 hours, plus once shortly after startup); the app itself
  never talks to GitHub from the browser.
- **`frontend/`** — the Angular v22 dashboard. It reads only from the backend's API
  (`frontend/src/app/core/api/showcase-api.ts`); it has no GitHub credentials or rate limit of
  its own, because it never calls GitHub directly. Only one plugin (`angular-guide`) is shown
  at a time today, even though the backend ingests and serves both — a plugin switcher is the
  natural follow-up.

A failed or slow sync doesn't hide bad data behind a blank page: `/api/sync/status` reports
whether the last sync succeeded, and the front end renders a visible staleness notice — stale
data with a visible marker beats a dashboard that silently looks fresh and empty.

## Local development

Neither half depends on the other to build or test. To see the full app working, run Postgres
and the backend first, then the front end against it.

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

### Front end

With the backend running on `http://localhost:8080/` (see above):

```bash
cd frontend
npm install
npx ng serve
```

Then open `http://localhost:4200/`. `ng serve` proxies `/api/*` to `http://localhost:8080`
(`frontend/proxy.conf.json`); the built production bundle expects `/api` to be served from the
same origin it's deployed on, so it is never hosted separately from a backend that can answer
that path.

To run the test suite:

```bash
cd frontend
npx ng test --watch=false
```

(`ng test` alone runs in watch mode and will hang a non-interactive shell; there is no
`--run` flag on this toolchain's Vitest builder — see the BG004 entries in
`docs/plugin-findings.md`.)

## Why this exists

This project was built to validate `angular-guide` and `spring-boot-guide` against real code,
not to demonstrate technique for its own sake. `docs/plugin-findings.md` and
`docs/spring-plugin-findings.md` are the logs of every hook firing encountered while building
it — true positives, false positives, and the rules that stayed silent on correct code — plus a
closing synthesis on whether each plugin, on net, caught more real mistakes than it cost in
friction.
