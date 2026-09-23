# Spring Boot backend — Design

**Date:** 2026-09-23
**Status:** Approved, ready for implementation planning
**Repo:** `github.com/j-morgan6/angular-guide-showcase`
**Validates:** `github.com/j-morgan6/spring-boot-guide` @ `bd245f0` (v1.0.0)
**Extends:** `2026-09-10-angular-guide-showcase-design.md`

## 1. Purpose

A Spring Boot 4 backend for the showcase, built entirely under `spring-boot-guide`'s
enforcement, serving the Angular front end from a database instead of from GitHub.

The purpose is the same one that produced the original showcase, pointed at the sibling
plugin. `spring-boot-guide` v1.0.0 ships 39 rules, 10 skills and 3 review agents, and
every assertion behind them runs against synthetic fixture workspaces built by its own
test harness. It has never been exercised against real code. Real code is where false
positives live, and a blocking rule that rejects correct work is the failure mode most
likely to get an enforcement plugin uninstalled.

`spring-boot-guide` already carries one defence `angular-guide` lacked — the mutation
gate, which caught SB105 and SB113 enforcing nothing before release. That gate proves a
rule *fires*. It cannot prove a rule fires *only when it should*. Nothing but real code
does that.

**The deliverable is `docs/spring-plugin-findings.md`.** The backend is the vehicle.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Purpose | Validation, not demo polish | Matches the original experiment; findings are the product |
| Scope | Ingestion **and** persistence | ~40% of the rule set is JPA-shaped; no database leaves it untested |
| Layout | Monorepo, `frontend/` + `backend/` | Buys a plugin-coexistence finding no single-plugin exercise can produce |
| Deployment | Deployable, not deployed | Writing deployment config exercises the config rules; running it produces no findings |
| Boot version | 4.x | Activates the most version-gated rules (SB019 blocking, SB020, SB103) — the plugin's newest and least-proven logic |

The scope decision carries a constraint that governs everything below: **the backend must
be code we would genuinely write.** Contriving a feature to trip a rule would invalidate
the result, because false positives only surface while writing code you believe is
correct. Every element below has a reason to exist independent of the rule it exercises.

## 3. Non-goals

- Not a deployment. No hosting, no managed Postgres, no public backend URL.
- Not a rewrite of the front end. The markdown token renderer and every `ui/` component
  stay as they are.
- Not a demonstration of every rule. Rules that only fire on bad code — SB001 field
  injection, SB010 `NoOpPasswordEncoder`, SB016 empty catch — will never trigger here,
  and writing bad code to make them fire would defeat the purpose.
- No authentication. The API is read-only and runs locally; an auth layer would be
  scope invented to exercise the security rules, which §2 forbids.

## 4. Architecture

Spring Boot 4.x, Java 21, Maven with wrapper, Postgres via Docker Compose, Flyway for
schema, JUnit 5 with Testcontainers.

Feature-first packages, with `@SpringBootApplication` at the base-package root so
component scanning reaches every feature:

```
com.jmorgan.showcase/
├── ShowcaseApplication.java
├── catalog/     Plugin, Rule, Skill + controller, service, repository
├── activity/    Commit, Contributor
├── finding/     Finding + triage
├── github/      GithubClient, GithubClientProperties, SyncService, SyncRun
└── config/      CORS policy only
```

`config/` holds exactly one thing: the CORS policy, which is genuinely application-wide
and has no single feature owner. The `project-structure` skill names this as the
sanctioned exception to its own rule; anything else landing there is a mistake.

`GithubClientProperties` lives beside `GithubClient` in `github/`, not in `config/` —
the thing and its configuration change together.

### Data flow

```
@Scheduled sync → GithubClient → Markdown table parser → upsert → Postgres
                                                                     │
Angular ── GET /api/** ── Controller → Service → Repository ─────────┘
```

GitHub is never on the request path. This is the substantive difference from the
original design, where every view fetched live and the 60-requests-per-hour
unauthenticated limit was mitigated rather than removed. A server-side token plus
scheduled ingestion removes it.

## 5. Domain model

```
Plugin 1──* Rule 1──* Finding
   │
   ├──* Skill
   ├──* Commit
   └──* Contributor

SyncRun  (standalone: startedAt, finishedAt, status, counts, error)
```

| Entity | Business key | Notes |
|---|---|---|
| `Plugin` | `slug` | `angular-guide`, `spring-boot-guide` |
| `Rule` | `plugin` + `ruleId` | `ruleId` is `NG014`, `SB005`; severity and gating as enums |
| `Skill` | `plugin` + `name` | Body stored as raw markdown, rendered client-side |
| `Finding` | surrogate | Links to `Rule`; verdict enum, why, action, recordedAt |
| `Commit` | `sha` | |
| `Contributor` | `plugin` + `login` | |
| `SyncRun` | surrogate | Feeds `/api/sync/status` |

Three constraints on every entity, each of which is also correct practice independent of
the rule behind it:

- **Explicit `fetch = FetchType.LAZY`** on every `@ManyToOne` and `@OneToOne`. SB112
  fires on a bare association and SB005 blocks `EAGER` outright. Associations are
  fetched deliberately with `@EntityGraph` or `join fetch` where a view needs them.
- **No Lombok on entities.** SB006 blocks `@Data`, `@EqualsAndHashCode` and `@ToString`
  in a file containing `@Entity`. `equals`/`hashCode` are written over the business key
  only — generated versions span the id and lazy associations, which breaks `Set`
  membership and triggers loads.
- **One type per entity file**, which is how SB003, SB004 and SB006 become evaluable at
  all: each is skipped when a file declares more than one type, because flat parsing
  cannot attribute an annotation to the right owner.

This is the densest expected source of findings. SB005, SB006, SB112 and the `jpa-review`
agent all converge on these five files.

## 6. Ingestion

A `@Scheduled` job syncs both plugin repositories on an interval and on startup.

- **Client:** `RestClient`, or an `@HttpExchange` interface client. Not `RestTemplate` —
  SB103 flags it from Boot 3.2 and it is deprecated at Boot 4 regardless.
- **Token:** `${GITHUB_TOKEN}` from the environment. SB012 blocks a literal secret in
  `src/main/resources/`, and a committed token would be wrong whether or not a rule
  caught it. Note that SB012 keys on the key's final dot-segment, so a key named
  `github.api-token` would **not** be flagged — the rule's own documentation is explicit
  that key naming alone cannot separate an auth token from a pagination token. Naming the
  property `github.token` is therefore deliberate.
- **Parsing:** the README rule tables become `Rule` rows. Pure functions, no Spring
  involvement, no annotations — a markdown table parser that takes a string and returns
  records.
- **Idempotence:** upsert on the business key. A sync that runs twice produces the same
  rows.
- **Failure:** a failed sync records a `SyncRun` with the error and leaves the previous
  data in place. Stale data with a visible staleness marker beats an empty dashboard.

`@Transactional` sits on the sync service methods, public, in the service layer. Never on
a controller (SB004), never private (SB003) — a proxy cannot intercept a private method
and the annotation silently does nothing.

## 7. API

```
GET /api/plugins
GET /api/plugins/{slug}/rules?severity=&gating=&q=
GET /api/plugins/{slug}/skills
GET /api/plugins/{slug}/skills/{name}
GET /api/plugins/{slug}/activity/commits
GET /api/plugins/{slug}/activity/contributors
GET /api/findings?ruleId=
GET /api/sync/status
```

All read-only. Constraints:

- **DTO records at the boundary, never entities.** SB110 fires when a `@RestController`
  imports a type from an `.entity.` or `.domain.model.` package *and* that type appears
  as a return or parameter type. Returning entities also leaks the persistence model into
  the wire format and invites lazy-loading surprises during serialization.
- **`@GetMapping`, never `@RequestMapping(method = …)`** (SB009).
- **Controllers stay thin** — no repository reference, under ~120 non-blank lines
  (SB113). Filtering and search live in the service or the query.
- **CORS enumerates origins.** SB105 fires on `allowedOrigins("*")`. The dev front end
  origin is listed explicitly.

## 8. Persistence and configuration

- **Flyway owns the schema.** `spring.jpa.hibernate.ddl-auto: validate` — SB007 blocks
  `create`, `create-drop` and `update` under `src/main/resources/`.
- **`spring.jpa.open-in-view: false`**, set explicitly. SB102 fires when the property is
  absent *or* true, so silence is not sufficient.
- **Actuator endpoints enumerated**, never `*` (SB013), which would expose `heapdump`,
  `env` and `threaddump`.
- **Profiles:** `local` (Compose Postgres), `test` (Testcontainers). A `Dockerfile` and
  real profile configuration are written and buildable; nothing is deployed.
- **Jackson 3.** Boot 4's default. SB020 fires on `com.fasterxml.jackson.*` imports other
  than `annotation`, so serialization customization uses `tools.jackson.*`.

## 9. Testing

Weighted the way the front end weights its own suite — heaviest on the pure functions.

| Layer | Approach |
|---|---|
| Markdown table parser | Heaviest. Pure functions, no Spring context, no database |
| Controllers | `@WebMvcTest` — SB109 fires on `@SpringBootTest` in a `*ControllerTest` |
| Repositories | `@DataJpaTest` + Testcontainers Postgres |
| Sync service | Mocked client, `@MockitoBean` — **blocking** at Boot 4 (SB019); `@MockBean` is removed there |
| Async waits | Awaitility, never `Thread.sleep` (SB017, which fires only under `src/test/java/`) |

JUnit 5 throughout. SB018 blocks any `org.junit.` import that is not `jupiter` or
`platform`, and `@RunWith`.

## 10. Front-end changes

`src/` moves to `frontend/`. `backend/` joins it at the repository root.

**Deleted** — now server-side, and redundant once an API exists:

- `core/parsing/rules.ts` and its spec
- `core/parsing/base64.ts` and its spec
- `core/github/` (replaced)

**Added:** `core/api/showcase-api.ts` — the same `httpResource` shape against `/api`,
through a dev proxy. One service, one place that knows the base URL.

**Unchanged:** `core/parsing/markdown.ts` and all of `ui/markdown/`. The NG014
component-renderer claim is the original design's principal falsifiable claim, it is
still unresolved, and nothing here disturbs it. Skill bodies are still rendered from a
token tree by real components.

**Changed in meaning:** the rate-limited UI state loses its trigger, because the browser
no longer talks to GitHub. It becomes a **stale-data** state fed by `/api/sync/status`:
last successful sync, and the error if the most recent attempt failed. The three-state
discipline — loading, degraded, failed — survives intact with an honest new third state.

## 11. Plugin coexistence

Both plugins are installed in one workspace. Neither has been run alongside the other.

Two specific risks, both worth recording whatever the outcome:

1. **Detection after the move.** `angular-guide`'s profile pins `workspace_root` at the
   repository root and its detector reads `angular.json` from there. Moving `angular.json`
   into `frontend/` may leave the profile stale or absent. `hook-lint.sh` exits 0 when no
   profile is found, so the failure mode is **silence, not an error** — every Angular rule
   quietly stops enforcing. The existing findings log already documents this shape at
   NG007.
2. **Gated rules depend on a resolved profile.** SB019, SB020 and SB103 key off
   `boot_major`, and `spring-boot-guide` skips a gated rule entirely rather than guessing
   when the version is unresolved. Choosing Boot 4 buys nothing unless detection actually
   resolves it, so the first check after scaffolding is that
   `.spring-boot-guide-project.json` exists and reports `boot_major: 4`.
3. **Cross-firing.** `angular-guide` matches `.ts`/`.html`; `spring-boot-guide` matches
   `.java` and `application*.{properties,yml,yaml}`. No overlap is expected. Two
   `SessionStart` detectors and two `PreToolUse` matchers running together is nonetheless
   untested.

**Mitigation:** before trusting any silence, deliberately probe each half with a known
violation — a `function f(x: any)` in `frontend/`, a field `@Autowired` in `backend/` —
and confirm both plugins block. Silence is not evidence that code is clean until the
hooks are proven live. Both probes are recorded as findings and removed.

## 12. The findings log

`docs/spring-plugin-findings.md`, in the format the existing log established: rule id,
file and line, the code, verbatim hook output, verdict (**true positive** / **false
positive** / **noise**), why, and the suggested action.

Also recorded:

- Rules that should have fired and did not.
- Points where a skill's advice conflicted with what the code actually needed.
- Anything the mutation gate could not have caught — a rule that fires correctly on its
  fixture and wrongly on real code is precisely the class of defect that gate is blind
  to, and the reason this exercise exists.

## 13. Success criteria

1. The backend builds and runs locally; all three front-end routes render against it.
2. Every hook firing during the build is recorded and triaged.
3. The log yields a concrete, prioritized fix list for `spring-boot-guide` v1.1 — or
   states plainly that no changes are warranted, which is an equally valid result.
4. A verdict on plugin coexistence: whether two enforcement plugins can share a workspace,
   and whether `angular-guide`'s detection survives the restructure.
5. The three `spring-boot-guide` review agents are each dispatched at least once against
   real code, and their output is triaged like any hook firing.
