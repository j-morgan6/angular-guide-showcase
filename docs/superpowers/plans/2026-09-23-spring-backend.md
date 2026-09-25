# Spring Boot Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Spring Boot 4 backend under `spring-boot-guide`'s enforcement that serves the Angular showcase from Postgres, and record every hook firing as a finding.

**Architecture:** A `@Scheduled` job ingests both plugin repositories from GitHub, parses their README rule tables in Java, and upserts into Postgres. A read-only REST API serves the Angular front end, which moves to `frontend/` alongside the new `backend/`. GitHub is never on the request path.

**Tech Stack:** Spring Boot 4.1, Java 21, Maven (wrapper), Postgres 16, Flyway, JUnit 5, Testcontainers, Angular 22 (zoneless, signals, Vitest).

**Spec:** `docs/superpowers/specs/2026-09-23-spring-backend-design.md`

## Global Constraints

These apply to **every** task. Most restate a `spring-boot-guide` rule; each is also correct practice on its own merits.

- **Java 21, Spring Boot 4.1.x.** An unresolved version makes the plugin skip SB019/SB020/SB103 silently.
- **Base package `com.jmorgan.showcase`**, `ShowcaseApplication` at its root. Feature-first packages, never `controller/`/`service/`/`repository/`.
- **Constructor injection only.** No field `@Autowired` (SB001). No `@Autowired` on a sole constructor (SB002). Injected fields are `private final` (SB106).
- **`@Transactional` only on public service methods** (SB003), never in a controller file (SB004).
- **Every `@ManyToOne`/`@OneToOne` carries an explicit `fetch = FetchType.LAZY`** (SB112, SB005).
- **No Lombok in any file containing `@Entity`** (SB006). One type per entity file.
- **`ddl-auto: validate`** (SB007). **`open-in-view: false`** explicitly (SB102). **Actuator endpoints enumerated**, never `*` (SB013).
- **No literal secrets in `src/main/resources/`** (SB012) — `${GITHUB_TOKEN}` only.
- **`@GetMapping`**, never `@RequestMapping(method = …)` (SB009). Controllers return DTO records, never entities (SB110), hold no repository reference, and stay under ~120 non-blank lines (SB113).
- **`RestClient`**, never `RestTemplate` (SB103). **`tools.jackson.*`**, never `com.fasterxml.jackson.*` except `annotation` (SB020).
- **JUnit 5 only** (SB018). `@MockitoBean`, never `@MockBean` (SB019, blocking at Boot 4). `@WebMvcTest` for `*ControllerTest` (SB109). Awaitility, never `Thread.sleep` (SB017).
- **No `System.out`/`printStackTrace`** in `src/main/java` (SB015) — SLF4J.
- **Use `./mvnw`, never bare `mvn`** (BG002). Never `spring-boot:run` from an agent session (BG004) — it never exits.
- **Record every hook firing** in `docs/spring-plugin-findings.md` as it happens, before fixing the code.

---

## File Structure

### New — `backend/`

| File | Responsibility |
|---|---|
| `pom.xml`, `mvnw`, `.mvn/` | Boot 4.1 parent, Java 21, wrapper |
| `src/main/java/com/jmorgan/showcase/ShowcaseApplication.java` | Entry point at base-package root |
| `catalog/Plugin.java`, `Rule.java`, `Skill.java` | Entities, one type per file |
| `catalog/RuleKind.java` | Enum: `BASH`, `BLOCKING`, `ADVISORY` |
| `catalog/PluginRepository.java`, `RuleRepository.java`, `SkillRepository.java` | Spring Data interfaces |
| `catalog/CatalogService.java` | Queries + transaction boundary |
| `catalog/CatalogController.java` | `/api/plugins/**` |
| `catalog/dto/PluginDto.java`, `RuleDto.java`, `SkillDto.java`, `SkillSummaryDto.java` | Wire types |
| `activity/Commit.java`, `Contributor.java` + repositories, service, controller, dto | `/api/plugins/{slug}/activity/**` |
| `finding/Finding.java`, `Verdict.java` + repository, service, controller, dto | `/api/findings` |
| `github/GithubClient.java` | `RestClient` wrapper |
| `github/GithubClientProperties.java` | `@ConfigurationProperties`, beside its client |
| `github/RuleTableParser.java` | **Pure functions.** README markdown → `ParsedRule` list |
| `github/ParsedRule.java` | Parser output record, no Spring or JPA |
| `github/SyncService.java` | Idempotent upsert, `@Scheduled` |
| `github/SyncRun.java`, `SyncStatus.java`, `SyncRunRepository.java` | Sync history |
| `github/SyncController.java` | `/api/sync/status` |
| `config/CorsConfig.java` | The one app-wide concern |
| `src/main/resources/application.yml` + `-local.yml` + `-test.yml` | Profiles |
| `src/main/resources/db/migration/V1__baseline.sql` | Flyway owns the schema |
| `src/test/java/**` | Mirrors main; parser tests heaviest |
| `Dockerfile`, `compose.yaml` | Buildable, not deployed |

### Moved — `frontend/`

Everything currently at the repo root belonging to the Angular app: `src/`, `public/`, `angular.json`, `package.json`, the npm lockfile, `tsconfig*.json`, `.prettierrc`, `.editorconfig`.

### Changed — front-end source

| File | Change |
|---|---|
| `core/api/showcase-api.ts` | **Create.** Replaces `GithubApi`, same `httpResource` shape against `/api` |
| `core/api/showcase.types.ts` | **Create.** `Rule`, `Skill`, `Commit`, `Contributor`, `SyncStatus` |
| `core/github/` | **Delete.** Both files |
| `core/parsing/rules.ts` + spec | **Delete.** Moved to Java |
| `core/parsing/base64.ts` + spec | **Delete.** Server decodes now |
| `core/parsing/markdown.ts`, `ui/markdown/**` | **Unchanged.** The NG014 claim stands |
| `ui/state/error-state.ts` | Rate-limited state becomes stale-data state |
| `features/rules/rules-page.ts` | Reads `api.rules`, drops local parsing |
| `features/skills/skills-page.ts` | Reads `api.skills`, keeps `MdView` rendering |
| `features/activity/activity-page.ts` | Reads `api.commits`/`api.contributors` |

---

## Task 1: Monorepo restructure

Moves the Angular app into `frontend/` so `backend/` can join it. Pure churn — no behaviour changes — so the gate is that the existing suite still passes untouched.

**Files:**
- Move: the Angular workspace files listed above → `frontend/`
- Modify: `.github/workflows/*.yml` (working directory), `README.md`, root `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `frontend/` as the Angular workspace root; all later front-end paths are `frontend/src/app/...`

- [ ] **Step 1: Record the baseline**

```bash
cd /Users/joser/Development/angular-guide-showcase && npm test -- --watch=false 2>&1 | tail -20
```

Write down the passing test count. That number must be identical at the end of this task.

- [ ] **Step 2: Move the workspace with git mv**

Use `git mv` for each path so history is preserved — a plain move shows every file as delete-plus-add:

```bash
mkdir -p frontend
git mv src public angular.json package.json frontend/
git mv tsconfig.json tsconfig.app.json tsconfig.spec.json frontend/
git mv .prettierrc .editorconfig frontend/
git mv package-lock.json frontend/
```

Then clear the stale root build artifacts — the `.angular` cache, `dist`, and `node_modules`. Keep the lockfile: it moved to `frontend/` and its pinned versions must survive.

- [ ] **Step 3: Verify no path in the workspace config needs changing**

`angular.json` refers to `src/main.ts`, `tsconfig.app.json`, `public`, `src/styles.css` — all **relative to the workspace root**, which is now `frontend/`. They stay correct. Confirm:

```bash
grep -n '"browser"\|"tsConfig"\|"styles"\|"input"' frontend/angular.json
```

Expected: `src/main.ts`, `tsconfig.app.json`, `src/styles.css`, `public` — unchanged.

- [ ] **Step 4: Reinstall and re-run the suite**

```bash
cd frontend && npm ci && npm test -- --watch=false 2>&1 | tail -20
```

Expected: the identical passing count from Step 1. Any difference means a path broke — fix before continuing.

- [ ] **Step 5: Verify the production build**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: build succeeds, output under `frontend/dist/`.

- [ ] **Step 6: Update the CI workflow**

Read the workflow first:

```bash
cat .github/workflows/*.yml
```

Add `defaults: { run: { working-directory: frontend } }` to the build job so `npm ci` and `npm run build` resolve, and repoint any `dist/showcase/browser` artifact path to `frontend/dist/showcase/browser`. Note that `actions/upload-pages-artifact` paths are **not** affected by `working-directory` and must be changed explicitly.

- [ ] **Step 7: Update the root .gitignore for the new layout**

```bash
grep -n "dist\|angular\|node_modules" .gitignore
```

A bare `dist` or `node_modules` pattern matches at any depth and is already correct. A **rooted** pattern (`/dist`) no longer matches and must become `frontend/dist`. Fix only the rooted ones.

- [ ] **Step 8: Check whether angular-guide detection survived**

This is a **finding, not just a check**. The profile pins `workspace_root` at the repo root and the detector reads `angular.json` from there.

```bash
cat .angular-guide-project.json
ls angular.json 2>&1 || echo "angular.json no longer at root — expected"
```

Now probe whether the hooks still enforce. Write this file and expect it to be **blocked**:

```typescript
// frontend/src/app/tmp-probe/probe.ts
export function probe(value: any) {
  return value;
}
```

Expected: NG007 blocks the write (`any` is banned). If the write **succeeds**, angular-guide has silently stopped enforcing — `hook-lint.sh` exits 0 when no profile resolves. Record that as a finding immediately, then re-run detection (re-open the session, or re-run the plugin's `detect_project.sh`) until the probe is blocked again.

Remove the probe file once it has been blocked.

- [ ] **Step 9: Record the restructure finding**

Append to `docs/plugin-findings.md` — this is an **angular-guide** finding, so it belongs in the existing log:

```markdown
### Detection after monorepo restructure (Task 1, Spring backend plan)
**Change:** `angular.json` moved from the repo root to `frontend/`.
**Verdict:** <true positive | false positive | noise — from what actually happened>
**Why:** <whether detection re-resolved, and whether the NG007 probe was still blocked>
**Action:** <e.g. detect_project.sh should search one level down, or none needed>
```

Fill every placeholder from observed behaviour — do not leave them.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: move Angular workspace into frontend/ for the monorepo

Pure move ahead of the Spring Boot backend. No source changes; the suite
passes at the same count as before.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Spring Boot scaffold and hook liveness

Creates the backend skeleton and — more importantly — **proves `spring-boot-guide` is actually enforcing** before any real code is written. Silence is not evidence of clean code until the hooks are proven live.

**Files:**
- Create: `backend/pom.xml`, `backend/mvnw`, `backend/mvnw.cmd`, `backend/.mvn/wrapper/maven-wrapper.properties`
- Create: `backend/src/main/java/com/jmorgan/showcase/ShowcaseApplication.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/ShowcaseApplicationTests.java`
- Create: `docs/spring-plugin-findings.md`

**Interfaces:**
- Consumes: `frontend/` layout from Task 1
- Produces: `com.jmorgan.showcase` base package; `./mvnw` from `backend/`; a resolved `.spring-boot-guide-project.json` with `boot_major: 4`

- [ ] **Step 1: Generate the project from start.spring.io**

```bash
cd /Users/joser/Development/angular-guide-showcase && curl -sS https://start.spring.io/starter.tgz \
  -d type=maven-project -d language=java -d javaVersion=21 \
  -d bootVersion=4.1.0 \
  -d groupId=com.jmorgan -d artifactId=showcase \
  -d name=showcase -d packageName=com.jmorgan.showcase \
  -d dependencies=web,data-jpa,postgresql,flyway,actuator,validation \
  -o /tmp/backend.tgz && mkdir -p backend && tar -xzf /tmp/backend.tgz -C backend && ls backend
```

If `bootVersion=4.1.0` is rejected, list what is offered and take the newest 4.x:

```bash
curl -sS https://start.spring.io/metadata/client | python3 -c "import json,sys; d=json.load(sys.stdin); print([v['id'] for v in d['bootVersion']['values']])"
```

Record the version used. **Do not fall back to a 3.x version** — the Boot 4 choice exists to activate the version-gated rules.

- [ ] **Step 2: Verify the plugin resolved the profile**

This gates everything. SB019, SB020 and SB103 are skipped entirely when `boot_major` is unresolved.

```bash
cat .spring-boot-guide-project.json 2>/dev/null || echo "NO PROFILE — hooks are inert"
```

Expected: a profile reporting `boot_major: 4`, `build_tool: maven`, `wrapper: true`. If absent, re-run detection (re-open the session) before continuing. **Do not proceed without it** — you would otherwise spend the whole build believing rules ran that never did.

- [ ] **Step 3: Probe that blocking rules fire**

Attempt to write this file. It **must be blocked** by SB001:

```java
// backend/src/main/java/com/jmorgan/showcase/Probe.java
package com.jmorgan.showcase;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class Probe {
    @Autowired
    private String value;
}
```

Expected: blocked with an SB001 message naming constructor injection. If the write succeeds, the hooks are not enforcing — stop and fix detection.

- [ ] **Step 4: Probe that the Bash guard fires**

```bash
cd backend && mvn -version
```

Expected: **blocked by BG002** — a bare `mvn` when a wrapper exists. Then confirm the sanctioned form works:

```bash
cd backend && ./mvnw -version
```

Expected: succeeds, printing Maven and Java 21.

- [ ] **Step 5: Create the findings log with both probes recorded**

Create `docs/spring-plugin-findings.md`:

```markdown
# spring-boot-guide — findings from real-code use

Validating `spring-boot-guide` @ `bd245f0` (v1.0.0) while building the showcase
backend. One entry per hook firing. Verdicts: **true positive** (rule was right),
**false positive** (rule was wrong), **noise** (technically right, not worth the
interruption).

Also recorded: rules that should have fired and did not, and points where a
skill's advice conflicted with what the code actually needed.

---

## Hook firings

### SB001 — backend/src/main/java/com/jmorgan/showcase/Probe.java (deliberate probe, Task 2)
**Code:** `@Autowired private String value;`
**Verdict:** true positive
**Why:** deliberate probe to confirm the hooks enforce before any real code was
written. Blocked as expected.
**Action:** none — file never created.

### BG002 — `mvn -version` (deliberate probe, Task 2)
**Code:** `mvn -version`
**Verdict:** true positive
**Why:** deliberate probe. A bare `mvn` with a wrapper present was blocked as
expected; `./mvnw -version` succeeded.
**Action:** none.
```

Change the verdicts if either probe behaved differently from the expectation.

- [ ] **Step 6: Write the context-load test**

```java
// backend/src/test/java/com/jmorgan/showcase/ShowcaseApplicationTests.java
package com.jmorgan.showcase;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ShowcaseApplicationTests {

    @Test
    void contextLoads() {
    }
}
```

The import is `org.junit.jupiter.api.Test` — SB018 blocks `org.junit.Test`.

- [ ] **Step 7: Run it and expect failure**

```bash
cd backend && ./mvnw -q test 2>&1 | tail -30
```

Expected: **FAILS.** `data-jpa` and `postgresql` are on the classpath with no datasource configured, so the context cannot start. That is the correct failing state — Task 3 fixes it.

- [ ] **Step 8: Commit the scaffold**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: scaffold Spring Boot 4 backend

Boot 4.1, Java 21, Maven wrapper, base package com.jmorgan.showcase.
Hook liveness probed first: SB001 blocked a field @Autowired and BG002
blocked a bare mvn, so the plugin is confirmed enforcing before any real
code lands. Context test fails pending a datasource (Task 3).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Datasource, Flyway schema, and Testcontainers

Turns the failing context test green by giving it a real database. Flyway owns the schema from the first migration — `ddl-auto` never creates anything.

**Files:**
- Create: `backend/src/main/resources/application.yml`, `application-local.yml`, `application-test.yml`
- Create: `backend/src/main/resources/db/migration/V1__baseline.sql`
- Create: `backend/compose.yaml`
- Create: `backend/src/test/java/com/jmorgan/showcase/PostgresTestBase.java`
- Modify: `backend/pom.xml` (Testcontainers, Awaitility)
- Modify: `backend/src/test/java/com/jmorgan/showcase/ShowcaseApplicationTests.java`

**Interfaces:**
- Consumes: the scaffold from Task 2
- Produces: `PostgresTestBase` — an abstract class every database-touching test extends; tables `plugin`, `rule`, `skill`, `commit_log`, `contributor`, `finding`, `sync_run`

- [ ] **Step 1: Add test dependencies to pom.xml**

Inside `<dependencies>`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.awaitility</groupId>
    <artifactId>awaitility</artifactId>
    <scope>test</scope>
</dependency>
```

Testcontainers versions come from the Boot parent's dependency management — do not pin them.

- [ ] **Step 2: Write the baseline migration**

```sql
-- backend/src/main/resources/db/migration/V1__baseline.sql
CREATE TABLE plugin (
    id              BIGSERIAL PRIMARY KEY,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    repo_full_name  VARCHAR(200) NOT NULL,
    version         VARCHAR(50),
    description     TEXT,
    synced_at       TIMESTAMPTZ
);

CREATE TABLE rule (
    id          BIGSERIAL PRIMARY KEY,
    plugin_id   BIGINT NOT NULL REFERENCES plugin(id),
    rule_key    VARCHAR(150) NOT NULL UNIQUE,
    rule_id     VARCHAR(20) NOT NULL,
    kind        VARCHAR(20) NOT NULL,
    trigger_text TEXT NOT NULL,
    fix_text    TEXT NOT NULL,
    gate_text   TEXT NOT NULL
);
CREATE INDEX idx_rule_plugin ON rule(plugin_id);

CREATE TABLE skill (
    id         BIGSERIAL PRIMARY KEY,
    plugin_id  BIGINT NOT NULL REFERENCES plugin(id),
    skill_key  VARCHAR(250) NOT NULL UNIQUE,
    name       VARCHAR(200) NOT NULL,
    body       TEXT NOT NULL
);
CREATE INDEX idx_skill_plugin ON skill(plugin_id);

CREATE TABLE commit_log (
    id          BIGSERIAL PRIMARY KEY,
    plugin_id   BIGINT NOT NULL REFERENCES plugin(id),
    sha         VARCHAR(64) NOT NULL UNIQUE,
    message     TEXT NOT NULL,
    author_name VARCHAR(200),
    author_avatar_url VARCHAR(500),
    url         VARCHAR(500),
    authored_at TIMESTAMPTZ
);
CREATE INDEX idx_commit_plugin ON commit_log(plugin_id);

CREATE TABLE contributor (
    id              BIGSERIAL PRIMARY KEY,
    plugin_id       BIGINT NOT NULL REFERENCES plugin(id),
    contributor_key VARCHAR(250) NOT NULL UNIQUE,
    login           VARCHAR(200) NOT NULL,
    avatar_url      VARCHAR(500),
    url             VARCHAR(500),
    contributions   INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_contributor_plugin ON contributor(plugin_id);

CREATE TABLE finding (
    id           BIGSERIAL PRIMARY KEY,
    rule_id      BIGINT NOT NULL REFERENCES rule(id),
    file_path    VARCHAR(500),
    verdict      VARCHAR(30) NOT NULL,
    why          TEXT,
    action       TEXT,
    recorded_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_finding_rule ON finding(rule_id);

CREATE TABLE sync_run (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL,
    finished_at  TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL,
    rules_synced INT NOT NULL DEFAULT 0,
    error        TEXT
);
```

`commit_log`, not `commit` — `commit` is a reserved word in Postgres. `rule` is not reserved and is safe.

- [ ] **Step 3: Write the base application.yml**

```yaml
# backend/src/main/resources/application.yml
spring:
  application:
    name: showcase
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true

management:
  endpoints:
    web:
      exposure:
        include: health,info

github:
  token: ${GITHUB_TOKEN:}
  base-url: https://api.github.com
  repos:
    - j-morgan6/angular-guide
    - j-morgan6/spring-boot-guide
  sync-interval: PT6H
```

Three rules converge here: `ddl-auto: validate` (SB007 blocks `create`/`update`), `open-in-view: false` set **explicitly** (SB102 fires when absent *or* true), and the actuator exposure enumerated (SB013 blocks `*`).

`github.token` is named deliberately: SB012 keys on the key's final dot-segment, so `token` **is** flagged when given a literal. `${GITHUB_TOKEN:}` is an environment reference and must not fire. If it does, that is a false positive worth recording.

- [ ] **Step 4: Write the profile configs**

```yaml
# backend/src/main/resources/application-local.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/showcase
    username: showcase
    password: ${DB_PASSWORD:showcase}
```

```yaml
# backend/src/main/resources/application-test.yml
spring:
  jpa:
    properties:
      hibernate:
        format_sql: true
```

The test profile takes its datasource from Testcontainers at runtime, so it declares none.

- [ ] **Step 5: Write compose.yaml**

```yaml
# backend/compose.yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: showcase
      POSTGRES_USER: showcase
      POSTGRES_PASSWORD: showcase
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U showcase"]
      interval: 5s
      retries: 10
```

- [ ] **Step 6: Write the Testcontainers base class**

```java
// backend/src/test/java/com/jmorgan/showcase/PostgresTestBase.java
package com.jmorgan.showcase;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * One container for the whole suite. Declared static and started once rather
 * than per-class, so the Flyway migration runs a single time.
 */
public abstract class PostgresTestBase {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

- [ ] **Step 7: Point the context test at it**

```java
// backend/src/test/java/com/jmorgan/showcase/ShowcaseApplicationTests.java
package com.jmorgan.showcase;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ShowcaseApplicationTests extends PostgresTestBase {

    @Test
    void contextLoads() {
    }
}
```

- [ ] **Step 8: Run and verify it passes**

```bash
cd backend && ./mvnw -q test 2>&1 | tail -30
```

Expected: **PASS.** Flyway applies `V1__baseline.sql` against the container, and `ddl-auto: validate` confirms no entity mapping contradicts it — there are no entities yet, so validation is trivially satisfied. Docker must be running.

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat: datasource, Flyway baseline schema, Testcontainers

Flyway owns the schema from V1; ddl-auto is validate. open-in-view is
false explicitly, actuator exposure enumerated. Context test passes
against a real Postgres container.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Catalog entities and repositories

The densest expected source of findings — SB005, SB006, SB112 and the `jpa-review` agent all converge on these files.

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/catalog/Plugin.java`, `Rule.java`, `Skill.java`, `RuleKind.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/catalog/PluginRepository.java`, `RuleRepository.java`, `SkillRepository.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/catalog/CatalogRepositoryTest.java`

**Interfaces:**
- Consumes: the schema from Task 3
- Produces:
  - `Plugin` — `getId()`, `getSlug()`, `getName()`, `getRepoFullName()`, `getVersion()`, `getDescription()`, `getSyncedAt()`, setters, `Plugin(String slug, String name, String repoFullName)`
  - `Rule` — `getRuleKey()`, `getRuleId()`, `getKind()`, `getTriggerText()`, `getFixText()`, `getGateText()`, `getPlugin()`, `Rule(Plugin plugin, String ruleId, RuleKind kind, String trigger, String fix, String gate)`
  - `Skill` — `getSkillKey()`, `getName()`, `getBody()`, `getPlugin()`, `Skill(Plugin plugin, String name, String body)`
  - `RuleKind` — `BASH`, `BLOCKING`, `ADVISORY`
  - `PluginRepository.findBySlug(String)` → `Optional<Plugin>`
  - `RuleRepository.findByPluginSlugOrderByRuleId(String)` → `List<Rule>`
  - `RuleRepository.findByRuleKey(String)` → `Optional<Rule>`
  - `SkillRepository.findByPluginSlugOrderByName(String)` → `List<Skill>`
  - `SkillRepository.findBySkillKey(String)` → `Optional<Skill>`

- [ ] **Step 1: Write the failing repository test**

```java
// backend/src/test/java/com/jmorgan/showcase/catalog/CatalogRepositoryTest.java
package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.PostgresTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class CatalogRepositoryTest extends PostgresTestBase {

    private final PluginRepository plugins;
    private final RuleRepository rules;

    @Autowired
    CatalogRepositoryTest(PluginRepository plugins, RuleRepository rules) {
        this.plugins = plugins;
        this.rules = rules;
    }

    @Test
    void findsRulesForOnePluginOnly() {
        Plugin angular = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Plugin spring = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        rules.save(new Rule(angular, "NG014", RuleKind.BLOCKING, "[innerHTML]", "Compose components", "none"));
        rules.save(new Rule(spring, "SB005", RuleKind.BLOCKING, "FetchType.EAGER", "Use LAZY", "none"));

        List<Rule> found = rules.findByPluginSlugOrderByRuleId("spring-boot-guide");

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getRuleId()).isEqualTo("SB005");
    }

    @Test
    void ruleKeyDisambiguatesSharedBashIdsAcrossPlugins() {
        Plugin angular = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Plugin spring = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        Rule a = rules.save(new Rule(angular, "BG001", RuleKind.BASH, "force push", "use lease", "none"));
        Rule s = rules.save(new Rule(spring, "BG001", RuleKind.BASH, "force push", "use lease", "none"));

        assertThat(a.getRuleKey()).isEqualTo("angular-guide:BG001");
        assertThat(s.getRuleKey()).isEqualTo("spring-boot-guide:BG001");

        Optional<Rule> byKey = rules.findByRuleKey("spring-boot-guide:BG001");
        assertThat(byKey).isPresent();
        assertThat(byKey.get().getPlugin().getSlug()).isEqualTo("spring-boot-guide");
    }
}
```

The second test exists because **both plugins ship BG001–BG006**. A natural key of `ruleId` alone would collide, so `ruleKey` is `"<pluginSlug>:<ruleId>"`. That also keeps `equals`/`hashCode` off the lazy `plugin` association — comparing entities would otherwise trigger a load.

Constructor injection into the test class, not `@Autowired` fields: SB001 skips `src/test/java/`, but the pattern is the same one the rest of the codebase uses.

- [ ] **Step 2: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=CatalogRepositoryTest test 2>&1 | tail -20
```

Expected: FAIL — compilation error, `Plugin` and friends do not exist.

- [ ] **Step 3: Write RuleKind**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/RuleKind.java
package com.jmorgan.showcase.catalog;

public enum RuleKind {
    BASH,
    BLOCKING,
    ADVISORY
}
```

- [ ] **Step 4: Write Plugin**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/Plugin.java
package com.jmorgan.showcase.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "plugin")
public class Plugin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(name = "repo_full_name", nullable = false)
    private String repoFullName;

    private String version;

    private String description;

    @Column(name = "synced_at")
    private Instant syncedAt;

    protected Plugin() {
        // JPA
    }

    public Plugin(String slug, String name, String repoFullName) {
        this.slug = slug;
        this.name = name;
        this.repoFullName = repoFullName;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRepoFullName() {
        return repoFullName;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(Instant syncedAt) {
        this.syncedAt = syncedAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Plugin that)) {
            return false;
        }
        return Objects.equals(slug, that.slug);
    }

    @Override
    public int hashCode() {
        return Objects.hash(slug);
    }
}
```

`equals`/`hashCode` are over `slug` — the business key — not the id and not every field. Lombok `@Data` would generate the all-field version and is blocked here by SB006 anyway.

`jakarta.persistence`, never `javax.persistence` — SB014 blocks the latter.

- [ ] **Step 5: Write Rule**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/Rule.java
package com.jmorgan.showcase.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Objects;

@Entity
@Table(name = "rule")
public class Rule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    /** "{pluginSlug}:{ruleId}" — both plugins ship BG001-BG006, so ruleId alone collides. */
    @Column(name = "rule_key", nullable = false, unique = true)
    private String ruleKey;

    @Column(name = "rule_id", nullable = false)
    private String ruleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RuleKind kind;

    @Column(name = "trigger_text", nullable = false, columnDefinition = "TEXT")
    private String triggerText;

    @Column(name = "fix_text", nullable = false, columnDefinition = "TEXT")
    private String fixText;

    @Column(name = "gate_text", nullable = false, columnDefinition = "TEXT")
    private String gateText;

    protected Rule() {
        // JPA
    }

    public Rule(Plugin plugin, String ruleId, RuleKind kind, String trigger, String fix, String gate) {
        this.plugin = plugin;
        this.ruleId = ruleId;
        this.ruleKey = plugin.getSlug() + ":" + ruleId;
        this.kind = kind;
        this.triggerText = trigger;
        this.fixText = fix;
        this.gateText = gate;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getRuleKey() {
        return ruleKey;
    }

    public String getRuleId() {
        return ruleId;
    }

    public RuleKind getKind() {
        return kind;
    }

    public String getTriggerText() {
        return triggerText;
    }

    public String getFixText() {
        return fixText;
    }

    public String getGateText() {
        return gateText;
    }

    public void update(RuleKind kind, String trigger, String fix, String gate) {
        this.kind = kind;
        this.triggerText = trigger;
        this.fixText = fix;
        this.gateText = gate;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Rule that)) {
            return false;
        }
        return Objects.equals(ruleKey, that.ruleKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ruleKey);
    }
}
```

The `@ManyToOne` carries an **explicit** `fetch = FetchType.LAZY`. SB112 fires on a bare one and SB005 blocks `EAGER`. `equals` reads `ruleKey`, a plain column, so comparing two rules never initializes the `plugin` proxy.

`update(...)` exists so the sync can refresh a row in place rather than delete-and-insert, which would churn ids and break `finding.rule_id` references.

- [ ] **Step 6: Write Skill**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/Skill.java
package com.jmorgan.showcase.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Objects;

@Entity
@Table(name = "skill")
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(name = "skill_key", nullable = false, unique = true)
    private String skillKey;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    protected Skill() {
        // JPA
    }

    public Skill(Plugin plugin, String name, String body) {
        this.plugin = plugin;
        this.name = name;
        this.skillKey = plugin.getSlug() + ":" + name;
        this.body = body;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getSkillKey() {
        return skillKey;
    }

    public String getName() {
        return name;
    }

    public String getBody() {
        return body;
    }

    public void updateBody(String body) {
        this.body = body;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Skill that)) {
            return false;
        }
        return Objects.equals(skillKey, that.skillKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(skillKey);
    }
}
```

- [ ] **Step 7: Write the three repositories**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/PluginRepository.java
package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PluginRepository extends JpaRepository<Plugin, Long> {

    Optional<Plugin> findBySlug(String slug);
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/RuleRepository.java
package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, Long> {

    List<Rule> findByPluginSlugOrderByRuleId(String slug);

    Optional<Rule> findByRuleKey(String ruleKey);
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/SkillRepository.java
package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    List<Skill> findByPluginSlugOrderByName(String slug);

    Optional<Skill> findBySkillKey(String skillKey);
}
```

`findByPluginSlug...` traverses the association in the query itself, so no entity is loaded to reach the slug.

- [ ] **Step 8: Run the tests and verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=CatalogRepositoryTest test 2>&1 | tail -20
```

Expected: PASS, both tests. If `ddl-auto: validate` complains, the entity mapping disagrees with `V1__baseline.sql` — fix the **migration**, never by loosening `ddl-auto`.

- [ ] **Step 9: Dispatch the jpa-review and project-structure agents**

These are the files `jpa-review` exists for. Dispatch `spring-boot-guide:jpa-review` against `backend/src/main/java/com/jmorgan/showcase/catalog/`, and triage every finding into `docs/spring-plugin-findings.md` exactly like a hook firing — including any finding you judge wrong, with the reasoning.

Also dispatch `spring-boot-guide:spring-project-structure` against `backend/src/main/java/` now, while the package layout is still cheap to change. The first feature package exists, so the layout decision is visible and not yet load-bearing across a dozen files. Task 14 dispatches it again against the finished backend; a disagreement between the two runs is itself worth recording.

- [ ] **Step 10: Commit**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: catalog entities and repositories

Plugin, Rule and Skill with explicit lazy associations and business-key
equals. ruleKey is pluginSlug:ruleId because both plugins ship BG001-BG006.
jpa-review dispatched and its findings triaged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Activity, finding, and sync entities

The remaining four entities, same constraints.

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/activity/Commit.java`, `Contributor.java`, `CommitRepository.java`, `ContributorRepository.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/finding/Finding.java`, `Verdict.java`, `FindingRepository.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/SyncRun.java`, `SyncStatus.java`, `SyncRunRepository.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/activity/ActivityRepositoryTest.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/github/SyncRunRepositoryTest.java`

**Interfaces:**
- Consumes: `Plugin`, `Rule` from Task 4; `PostgresTestBase` from Task 3
- Produces:
  - `Commit(Plugin plugin, String sha, String message, String authorName, String authorAvatarUrl, String url, Instant authoredAt)`; `getSha()`, `getMessage()`, `getAuthorName()`, `getAuthorAvatarUrl()`, `getUrl()`, `getAuthoredAt()`
  - `Contributor(Plugin plugin, String login, String avatarUrl, String url, int contributions)`; `getContributorKey()`, `getLogin()`, `getAvatarUrl()`, `getUrl()`, `getContributions()`, `setContributions(int)`
  - `Finding(Rule rule, String filePath, Verdict verdict, String why, String action, Instant recordedAt)`
  - `Verdict` — `TRUE_POSITIVE`, `FALSE_POSITIVE`, `NOISE`
  - `SyncRun` — `started(Instant)` static factory, `succeed(Instant, int)`, `fail(Instant, String)`, `getStatus()`, `getFinishedAt()`, `getRulesSynced()`, `getError()`, `getStartedAt()`
  - `SyncStatus` — `RUNNING`, `SUCCEEDED`, `FAILED`
  - `CommitRepository.findByPluginSlugOrderByAuthoredAtDesc(String)` → `List<Commit>`, `findBySha(String)` → `Optional<Commit>`
  - `ContributorRepository.findByPluginSlugOrderByContributionsDesc(String)` → `List<Contributor>`, `findByContributorKey(String)` → `Optional<Contributor>`
  - `FindingRepository.findByRuleRuleKey(String)` → `List<Finding>`, `findAllByOrderByRecordedAtDesc()` → `List<Finding>`
  - `SyncRunRepository.findFirstByOrderByStartedAtDesc()` → `Optional<SyncRun>`

- [ ] **Step 1: Write the failing activity test**

```java
// backend/src/test/java/com/jmorgan/showcase/activity/ActivityRepositoryTest.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.PostgresTestBase;
import com.jmorgan.showcase.catalog.Plugin;
import com.jmorgan.showcase.catalog.PluginRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ActivityRepositoryTest extends PostgresTestBase {

    private final PluginRepository plugins;
    private final CommitRepository commits;
    private final ContributorRepository contributors;

    @Autowired
    ActivityRepositoryTest(PluginRepository plugins, CommitRepository commits, ContributorRepository contributors) {
        this.plugins = plugins;
        this.commits = commits;
        this.contributors = contributors;
    }

    @Test
    void returnsCommitsNewestFirst() {
        Plugin plugin = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Instant older = Instant.parse("2026-09-01T00:00:00Z");
        Instant newer = Instant.parse("2026-09-10T00:00:00Z");

        commits.save(new Commit(plugin, "aaa1111", "older", "j", "", "", older));
        commits.save(new Commit(plugin, "bbb2222", "newer", "j", "", "", newer));

        List<Commit> found = commits.findByPluginSlugOrderByAuthoredAtDesc("angular-guide");

        assertThat(found).extracting(Commit::getMessage).containsExactly("newer", "older");
    }

    @Test
    void ranksContributorsByContributions() {
        Plugin plugin = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        contributors.save(new Contributor(plugin, "quiet", "", "", 3));
        contributors.save(new Contributor(plugin, "busy", "", "", 42));

        List<Contributor> found = contributors.findByPluginSlugOrderByContributionsDesc("spring-boot-guide");

        assertThat(found).extracting(Contributor::getLogin).containsExactly("busy", "quiet");
    }
}
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=ActivityRepositoryTest test 2>&1 | tail -20
```

Expected: FAIL — compilation error, the activity types do not exist.

- [ ] **Step 3: Write Commit**

```java
// backend/src/main/java/com/jmorgan/showcase/activity/Commit.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.catalog.Plugin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "commit_log")
public class Commit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(nullable = false, unique = true)
    private String sha;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "author_avatar_url")
    private String authorAvatarUrl;

    private String url;

    @Column(name = "authored_at")
    private Instant authoredAt;

    protected Commit() {
        // JPA
    }

    public Commit(Plugin plugin, String sha, String message, String authorName,
                  String authorAvatarUrl, String url, Instant authoredAt) {
        this.plugin = plugin;
        this.sha = sha;
        this.message = message;
        this.authorName = authorName;
        this.authorAvatarUrl = authorAvatarUrl;
        this.url = url;
        this.authoredAt = authoredAt;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getSha() {
        return sha;
    }

    public String getMessage() {
        return message;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getAuthorAvatarUrl() {
        return authorAvatarUrl;
    }

    public String getUrl() {
        return url;
    }

    public Instant getAuthoredAt() {
        return authoredAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Commit that)) {
            return false;
        }
        return Objects.equals(sha, that.sha);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sha);
    }
}
```

A commit SHA is globally unique, so it is the business key on its own — no plugin prefix needed.

- [ ] **Step 4: Write Contributor**

```java
// backend/src/main/java/com/jmorgan/showcase/activity/Contributor.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.catalog.Plugin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Objects;

@Entity
@Table(name = "contributor")
public class Contributor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(name = "contributor_key", nullable = false, unique = true)
    private String contributorKey;

    @Column(nullable = false)
    private String login;

    @Column(name = "avatar_url")
    private String avatarUrl;

    private String url;

    @Column(nullable = false)
    private int contributions;

    protected Contributor() {
        // JPA
    }

    public Contributor(Plugin plugin, String login, String avatarUrl, String url, int contributions) {
        this.plugin = plugin;
        this.login = login;
        this.contributorKey = plugin.getSlug() + ":" + login;
        this.avatarUrl = avatarUrl;
        this.url = url;
        this.contributions = contributions;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getContributorKey() {
        return contributorKey;
    }

    public String getLogin() {
        return login;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getUrl() {
        return url;
    }

    public int getContributions() {
        return contributions;
    }

    public void setContributions(int contributions) {
        this.contributions = contributions;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Contributor that)) {
            return false;
        }
        return Objects.equals(contributorKey, that.contributorKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(contributorKey);
    }
}
```

- [ ] **Step 5: Write the activity repositories**

```java
// backend/src/main/java/com/jmorgan/showcase/activity/CommitRepository.java
package com.jmorgan.showcase.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommitRepository extends JpaRepository<Commit, Long> {

    List<Commit> findByPluginSlugOrderByAuthoredAtDesc(String slug);

    Optional<Commit> findBySha(String sha);
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/activity/ContributorRepository.java
package com.jmorgan.showcase.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContributorRepository extends JpaRepository<Contributor, Long> {

    List<Contributor> findByPluginSlugOrderByContributionsDesc(String slug);

    Optional<Contributor> findByContributorKey(String contributorKey);
}
```

- [ ] **Step 6: Run the activity tests and verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=ActivityRepositoryTest test 2>&1 | tail -20
```

Expected: PASS, both tests.

- [ ] **Step 7: Write Verdict and Finding**

```java
// backend/src/main/java/com/jmorgan/showcase/finding/Verdict.java
package com.jmorgan.showcase.finding;

public enum Verdict {
    TRUE_POSITIVE,
    FALSE_POSITIVE,
    NOISE
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/finding/Finding.java
package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.catalog.Rule;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "finding")
public class Finding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_id", nullable = false)
    private Rule rule;

    @Column(name = "file_path")
    private String filePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Verdict verdict;

    @Column(columnDefinition = "TEXT")
    private String why;

    @Column(columnDefinition = "TEXT")
    private String action;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected Finding() {
        // JPA
    }

    public Finding(Rule rule, String filePath, Verdict verdict, String why, String action, Instant recordedAt) {
        this.rule = rule;
        this.filePath = filePath;
        this.verdict = verdict;
        this.why = why;
        this.action = action;
        this.recordedAt = recordedAt;
    }

    public Long getId() {
        return id;
    }

    public Rule getRule() {
        return rule;
    }

    public String getFilePath() {
        return filePath;
    }

    public Verdict getVerdict() {
        return verdict;
    }

    public String getWhy() {
        return why;
    }

    public String getAction() {
        return action;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }
}
```

`Finding` deliberately has **no** `equals`/`hashCode` override: it has no business key — two findings for the same rule on the same file at different times are genuinely different rows — so identity semantics are correct here. Overriding on a surrogate id would be worse.

- [ ] **Step 8: Write FindingRepository**

```java
// backend/src/main/java/com/jmorgan/showcase/finding/FindingRepository.java
package com.jmorgan.showcase.finding;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FindingRepository extends JpaRepository<Finding, Long> {

    List<Finding> findByRuleRuleKey(String ruleKey);

    List<Finding> findAllByOrderByRecordedAtDesc();
}
```

- [ ] **Step 9: Write SyncStatus and SyncRun**

```java
// backend/src/main/java/com/jmorgan/showcase/github/SyncStatus.java
package com.jmorgan.showcase.github;

public enum SyncStatus {
    RUNNING,
    SUCCEEDED,
    FAILED
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/github/SyncRun.java
package com.jmorgan.showcase.github;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "sync_run")
public class SyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SyncStatus status;

    @Column(name = "rules_synced", nullable = false)
    private int rulesSynced;

    @Column(columnDefinition = "TEXT")
    private String error;

    protected SyncRun() {
        // JPA
    }

    private SyncRun(Instant startedAt) {
        this.startedAt = startedAt;
        this.status = SyncStatus.RUNNING;
    }

    public static SyncRun started(Instant at) {
        return new SyncRun(at);
    }

    public void succeed(Instant at, int rulesSynced) {
        this.finishedAt = at;
        this.status = SyncStatus.SUCCEEDED;
        this.rulesSynced = rulesSynced;
        this.error = null;
    }

    public void fail(Instant at, String error) {
        this.finishedAt = at;
        this.status = SyncStatus.FAILED;
        this.error = error;
    }

    public Long getId() {
        return id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public SyncStatus getStatus() {
        return status;
    }

    public int getRulesSynced() {
        return rulesSynced;
    }

    public String getError() {
        return error;
    }
}
```

- [ ] **Step 10: Write SyncRunRepository and its test**

```java
// backend/src/main/java/com/jmorgan/showcase/github/SyncRunRepository.java
package com.jmorgan.showcase.github;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SyncRunRepository extends JpaRepository<SyncRun, Long> {

    Optional<SyncRun> findFirstByOrderByStartedAtDesc();
}
```

```java
// backend/src/test/java/com/jmorgan/showcase/github/SyncRunRepositoryTest.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.PostgresTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SyncRunRepositoryTest extends PostgresTestBase {

    private final SyncRunRepository runs;

    @Autowired
    SyncRunRepositoryTest(SyncRunRepository runs) {
        this.runs = runs;
    }

    @Test
    void latestRunIsTheMostRecentlyStarted() {
        SyncRun older = SyncRun.started(Instant.parse("2026-09-01T00:00:00Z"));
        older.succeed(Instant.parse("2026-09-01T00:01:00Z"), 30);
        runs.save(older);

        SyncRun newer = SyncRun.started(Instant.parse("2026-09-10T00:00:00Z"));
        newer.fail(Instant.parse("2026-09-10T00:00:05Z"), "connection refused");
        runs.save(newer);

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();

        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(latest.get().getError()).isEqualTo("connection refused");
    }
}
```

- [ ] **Step 11: Run the whole suite**

```bash
cd backend && ./mvnw -q test 2>&1 | tail -30
```

Expected: PASS — context load, catalog, activity, and sync-run tests.

- [ ] **Step 12: Commit**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: activity, finding and sync-run entities

Commit keyed on sha, Contributor on pluginSlug:login, Finding with no
business key by design. SyncRun records each ingestion attempt.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rule table parser

Pure functions, no Spring, no JPA — the Java counterpart of `core/parsing/rules.ts`, and the most heavily tested unit in the backend.

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/github/ParsedRule.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/RuleTableParser.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/github/RuleTableParserTest.java`
- Create: `backend/src/test/resources/fixtures/angular-guide-readme.md` (copied from the front-end fixture)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ParsedRule(String ruleId, RuleKind kind, String trigger, String fix, String gate)` — a record
  - `RuleTableParser.parse(String markdown)` → `List<ParsedRule>`, never throws, `[]` when nothing matches

- [ ] **Step 1: Copy the existing fixture**

```bash
mkdir -p backend/src/test/resources/fixtures
cp frontend/src/app/core/parsing/__fixtures__/angular-guide-readme.md \
   backend/src/test/resources/fixtures/angular-guide-readme.md
```

Reusing the same fixture the TypeScript parser was tested against means a behaviour difference between the two shows up immediately.

- [ ] **Step 2: Write the failing parser test**

```java
// backend/src/test/java/com/jmorgan/showcase/github/RuleTableParserTest.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleTableParserTest {

    private static String fixture(String name) {
        try (InputStream in = RuleTableParserTest.class.getResourceAsStream("/fixtures/" + name)) {
            if (in == null) {
                throw new IllegalStateException("fixture not found: " + name);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    void classifiesByPrefixAndNumber() {
        String md = """
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | BG001 | a force push | use lease | none |
                | SB005 | eager fetch | use LAZY | none |
                | SB101 | self-invocation | split the bean | none |
                """;

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).extracting(ParsedRule::ruleId).containsExactly("BG001", "SB005", "SB101");
        assertThat(rules).extracting(ParsedRule::kind)
                .containsExactly(RuleKind.BASH, RuleKind.BLOCKING, RuleKind.ADVISORY);
    }

    @Test
    void skipsRowsWhoseFirstCellIsNotARuleId() {
        String md = """
                | Endpoint | For |
                |---|---|
                | GET /repos | metadata |
                | SB005 | eager fetch | use LAZY | none |
                """;

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).extracting(ParsedRule::ruleId).containsExactly("SB005");
    }

    @Test
    void preservesPipesInsideInlineCode() {
        String md = "| SB009 | `@RequestMapping(method = …)` | Use `@GetMapping`/`@PostMapping` | none |";

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst().fix()).isEqualTo("Use `@GetMapping`/`@PostMapping`");
    }

    @Test
    void handlesEscapedPipesInCellText() {
        String md = "| SB008 | a `+` concat with \\| in it | use parameters | none |";

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst().trigger()).contains("|");
    }

    @Test
    void returnsEmptyForMarkdownWithNoRuleTables() {
        assertThat(RuleTableParser.parse("# Just a heading\n\nSome prose.")).isEmpty();
    }

    @Test
    void returnsEmptyForNullAndBlankInput() {
        assertThat(RuleTableParser.parse(null)).isEmpty();
        assertThat(RuleTableParser.parse("")).isEmpty();
        assertThat(RuleTableParser.parse("   ")).isEmpty();
    }

    @Test
    void parsesTheRealAngularGuideReadme() {
        List<ParsedRule> rules = RuleTableParser.parse(fixture("angular-guide-readme.md"));

        assertThat(rules).isNotEmpty();
        assertThat(rules).extracting(ParsedRule::ruleId).contains("NG014");
        assertThat(rules).allSatisfy(rule -> {
            assertThat(rule.ruleId()).isNotBlank();
            assertThat(rule.trigger()).isNotBlank();
            assertThat(rule.fix()).isNotBlank();
        });
    }

    @Test
    void isIdempotentAcrossRepeatedParses() {
        String md = fixture("angular-guide-readme.md");

        assertThat(RuleTableParser.parse(md)).isEqualTo(RuleTableParser.parse(md));
    }
}
```

`ParsedRule` is a record, so `isEqualTo` on two lists compares by value — that is what makes the idempotence test meaningful.

- [ ] **Step 3: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=RuleTableParserTest test 2>&1 | tail -20
```

Expected: FAIL — compilation error, `ParsedRule` and `RuleTableParser` do not exist.

- [ ] **Step 4: Write ParsedRule**

```java
// backend/src/main/java/com/jmorgan/showcase/github/ParsedRule.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;

/**
 * One row of a plugin README's rule table. A plain record — no Spring, no JPA,
 * no annotations — so the parser is testable without a context.
 */
public record ParsedRule(String ruleId, RuleKind kind, String trigger, String fix, String gate) {
}
```

- [ ] **Step 5: Write RuleTableParser**

```java
// backend/src/main/java/com/jmorgan/showcase/github/RuleTableParser.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the rule tables out of a plugin README.
 *
 * Every rule table is four columns — ID, what it catches, the fix, the version
 * gate — so a row is a rule exactly when its first cell is a rule ID. Rows that
 * are not (prose tables elsewhere in the README) are skipped rather than treated
 * as errors, because a README legitimately contains other tables.
 *
 * Deliberately line-based rather than a full markdown parse: the only structure
 * that matters is the pipe-delimited row, and a full lexer would be a dependency
 * and a failure mode for no gain.
 *
 * Never throws. Returns an empty list when nothing matches.
 */
public final class RuleTableParser {

    private static final Pattern RULE_ID = Pattern.compile("^(BG|NG|SB)(\\d{3})$");

    /** A pipe that is not escaped and not inside a backtick span. */
    private static final String ESCAPED_PIPE = "\u0001";  // cannot occur in markdown

    private RuleTableParser() {
    }

    public static List<ParsedRule> parse(String markdown) {
        List<ParsedRule> rules = new ArrayList<>();
        if (markdown == null || markdown.isBlank()) {
            return rules;
        }

        for (String line : markdown.split("\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|")) {
                continue;
            }
            List<String> cells = splitRow(trimmed);
            if (cells.size() != 4) {
                continue;
            }
            Matcher match = RULE_ID.matcher(cells.getFirst());
            if (!match.matches()) {
                continue;
            }
            rules.add(new ParsedRule(
                    cells.get(0),
                    classify(match.group(1), Integer.parseInt(match.group(2))),
                    cells.get(1),
                    cells.get(2),
                    cells.get(3)));
        }

        return rules;
    }

    private static RuleKind classify(String prefix, int number) {
        if ("BG".equals(prefix)) {
            return RuleKind.BASH;
        }
        return number >= 100 ? RuleKind.ADVISORY : RuleKind.BLOCKING;
    }

    /**
     * Split a table row on unescaped pipes that are not inside inline code.
     * Rule text is full of `a | b` inside backticks, and splitting naively on
     * "|" would shred those cells.
     */
    private static List<String> splitRow(String row) {
        String protectedRow = row.replace("\\|", ESCAPED_PIPE);

        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inCode = false;

        for (int i = 0; i < protectedRow.length(); i++) {
            char c = protectedRow.charAt(i);
            if (c == '`') {
                inCode = !inCode;
                current.append(c);
            } else if (c == '|' && !inCode) {
                cells.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        cells.add(current.toString());

        List<String> cleaned = new ArrayList<>();
        for (String cell : cells) {
            String value = cell.replace(ESCAPED_PIPE, "|").trim();
            if (!value.isEmpty()) {
                cleaned.add(value);
            }
        }
        return cleaned;
    }
}
```

The leading and trailing pipes produce empty edge cells, which the `isEmpty()` filter drops — that is why a four-column row yields exactly four cells. It also means a genuinely empty cell is dropped, so a rule row with an empty gate column would parse as three cells and be skipped. The real READMEs always write `none`, so this is acceptable; if a future README leaves a gate blank, this is where it breaks and the test suite will say so.

- [ ] **Step 6: Run the tests and verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=RuleTableParserTest test 2>&1 | tail -30
```

Expected: PASS, all eight tests. If `parsesTheRealAngularGuideReadme` fails, the fixture's table shape differs from the assumption — fix the parser, not the fixture.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat: rule table parser

Pure functions, line-based, backtick-aware so inline code containing pipes
survives. Tested against the same README fixture as the TypeScript parser
it replaces.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: GitHub client

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/github/GithubClientProperties.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/GithubClient.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/GithubContent.java`, `GithubCommit.java`, `GithubContributor.java`, `GithubRepo.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/github/GithubClientTest.java`
- Modify: `backend/src/main/java/com/jmorgan/showcase/ShowcaseApplication.java` (enable configuration properties and scheduling)

**Interfaces:**
- Consumes: `application.yml` keys under `github.*` from Task 3
- Produces:
  - `GithubClientProperties` — `token()`, `baseUrl()`, `repos()` (`List<String>`), `syncInterval()` (`Duration`)
  - `GithubClient.fetchRepo(String repoFullName)` → `GithubRepo`
  - `GithubClient.fetchFile(String repoFullName, String path)` → `String` (decoded UTF-8, `""` when absent)
  - `GithubClient.fetchCommits(String repoFullName, int perPage)` → `List<GithubCommit>`
  - `GithubClient.fetchContributors(String repoFullName)` → `List<GithubContributor>`
  - `GithubClient.listSkillNames(String repoFullName)` → `List<String>`

- [ ] **Step 1: Write the properties record**

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubClientProperties.java
package com.jmorgan.showcase.github;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/**
 * Lives beside GithubClient rather than in a shared config package: the client
 * and its configuration change together.
 */
@ConfigurationProperties(prefix = "github")
public record GithubClientProperties(
        String token,
        String baseUrl,
        List<String> repos,
        Duration syncInterval) {
}
```

A record with four bound properties, not five `@Value` fields — SB107 fires above five `@Value` annotations in one file, and `@ConfigurationProperties` is the better shape regardless.

- [ ] **Step 2: Write the response records**

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubRepo.java
package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubRepo(String name, String description, @JsonProperty("pushed_at") String pushedAt) {
}
```

`com.fasterxml.jackson.annotation` is the **one** Jackson 2 package SB020 exempts — Jackson 3 keeps the annotations deliberately so they work against both. Any other `com.fasterxml.jackson.*` import is blocked.

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubContent.java
package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubContent(String name, String path, String type, String content, String encoding) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubCommit.java
package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubCommit(
        String sha,
        Detail commit,
        Author author,
        @JsonProperty("html_url") String htmlUrl) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Detail(String message, Author author) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Author(String name, Instant date, @JsonProperty("avatar_url") String avatarUrl) {
    }
}
```

Nested records in one file are fine — SB003/SB004/SB006 skip multi-type files, but none of those rules apply to a file with no `@Entity`, no `@Transactional` and no controller annotation.

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubContributor.java
package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubContributor(
        String login,
        @JsonProperty("avatar_url") String avatarUrl,
        @JsonProperty("html_url") String htmlUrl,
        int contributions) {
}
```

- [ ] **Step 3: Write the failing client test**

```java
// backend/src/test/java/com/jmorgan/showcase/github/GithubClientTest.java
package com.jmorgan.showcase.github;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GithubClientTest {

    private static final String BASE = "https://api.github.com";

    private GithubClient clientWith(MockRestServiceServer[] serverOut, String token) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        GithubClientProperties props = new GithubClientProperties(
                token, BASE, List.of("j-morgan6/angular-guide"), Duration.ofHours(6));
        return new GithubClient(builder, props);
    }

    @Test
    void decodesBase64FileContent() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        String body = Base64.getEncoder().encodeToString("# Hello — em dash".getBytes(StandardCharsets.UTF_8));
        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/README.md"))
                .andRespond(withSuccess(
                        "{\"name\":\"README.md\",\"path\":\"README.md\",\"type\":\"file\",\"content\":\""
                                + body + "\",\"encoding\":\"base64\"}",
                        MediaType.APPLICATION_JSON));

        String content = client.fetchFile("j-morgan6/angular-guide", "README.md");

        assertThat(content).isEqualTo("# Hello — em dash");
        server[0].verify();
    }

    @Test
    void sendsAuthorizationHeaderWhenTokenIsPresent() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "ghp_example");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer ghp_example"))
                .andRespond(withSuccess("{\"name\":\"angular-guide\"}", MediaType.APPLICATION_JSON));

        client.fetchRepo("j-morgan6/angular-guide");

        server[0].verify();
    }

    @Test
    void returnsEmptyStringWhenFileIsMissing() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/nope.md"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.NOT_FOUND));

        assertThat(client.fetchFile("j-morgan6/angular-guide", "nope.md")).isEmpty();
    }

    @Test
    void listsSkillDirectoryNames() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        GithubClient client = clientWith(server, "");

        server[0].expect(requestTo(BASE + "/repos/j-morgan6/angular-guide/contents/skills"))
                .andRespond(withSuccess("""
                        [{"name":"data-loading","path":"skills/data-loading","type":"dir"},
                         {"name":"README.md","path":"skills/README.md","type":"file"}]
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.listSkillNames("j-morgan6/angular-guide")).containsExactly("data-loading");
    }
}
```

`MockRestServiceServer` binds to the `RestClient.Builder`, so no HTTP leaves the test and no Spring context is started.

- [ ] **Step 4: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=GithubClientTest test 2>&1 | tail -20
```

Expected: FAIL — `GithubClient` does not exist.

- [ ] **Step 5: Write GithubClient**

```java
// backend/src/main/java/com/jmorgan/showcase/github/GithubClient.java
package com.jmorgan.showcase.github;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Reads the plugin repositories from GitHub.
 *
 * RestClient, not RestTemplate: RestTemplate is deprecated at Boot 4 and
 * SB103 flags it from 3.2 onward.
 */
@Component
public class GithubClient {

    private static final Logger log = LoggerFactory.getLogger(GithubClient.class);

    private final RestClient restClient;

    public GithubClient(RestClient.Builder builder, GithubClientProperties properties) {
        RestClient.Builder configured = builder
                .baseUrl(properties.baseUrl())
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json");
        if (properties.token() != null && !properties.token().isBlank()) {
            configured = configured.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token());
        }
        this.restClient = configured.build();
    }

    public GithubRepo fetchRepo(String repoFullName) {
        return restClient.get()
                .uri("/repos/{repo}", repoFullName)
                .retrieve()
                .body(GithubRepo.class);
    }

    /**
     * A file's decoded UTF-8 content, or "" when it does not exist.
     *
     * GitHub wraps base64 at 60 characters, so the newlines are stripped before
     * decoding; the bytes are then read as UTF-8 to keep em dashes and emoji
     * intact, which the plugin docs are full of.
     */
    public String fetchFile(String repoFullName, String path) {
        try {
            GithubContent content = restClient.get()
                    .uri("/repos/{repo}/contents/{path}", repoFullName, path)
                    .retrieve()
                    .body(GithubContent.class);
            if (content == null || content.content() == null) {
                return "";
            }
            byte[] decoded = Base64.getMimeDecoder().decode(content.content());
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (RestClientResponseException e) {
            log.warn("Could not fetch {}/{}: {}", repoFullName, path, e.getStatusCode());
            return "";
        }
    }

    public List<GithubCommit> fetchCommits(String repoFullName, int perPage) {
        GithubCommit[] commits = restClient.get()
                .uri("/repos/{repo}/commits?per_page={perPage}", repoFullName, perPage)
                .retrieve()
                .body(GithubCommit[].class);
        return commits == null ? List.of() : List.of(commits);
    }

    public List<GithubContributor> fetchContributors(String repoFullName) {
        GithubContributor[] contributors = restClient.get()
                .uri("/repos/{repo}/contributors", repoFullName)
                .retrieve()
                .body(GithubContributor[].class);
        return contributors == null ? List.of() : List.of(contributors);
    }

    /** The directory names under skills/ — each holds one SKILL.md. */
    public List<String> listSkillNames(String repoFullName) {
        try {
            GithubContent[] entries = restClient.get()
                    .uri("/repos/{repo}/contents/skills", repoFullName)
                    .retrieve()
                    .body(GithubContent[].class);
            if (entries == null) {
                return List.of();
            }
            List<String> names = new ArrayList<>();
            for (GithubContent entry : entries) {
                if ("dir".equals(entry.type())) {
                    names.add(entry.name());
                }
            }
            return names;
        } catch (RestClientResponseException e) {
            log.warn("Could not list skills for {}: {}", repoFullName, e.getStatusCode());
            return List.of();
        }
    }
}
```

`Base64.getMimeDecoder()` tolerates the embedded newlines; `getDecoder()` would reject them. SLF4J throughout — SB015 blocks `System.out` and bare `printStackTrace`.

- [ ] **Step 6: Enable configuration properties and scheduling**

```java
// backend/src/main/java/com/jmorgan/showcase/ShowcaseApplication.java
package com.jmorgan.showcase;

import com.jmorgan.showcase.github.GithubClientProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(GithubClientProperties.class)
@EnableScheduling
public class ShowcaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShowcaseApplication.class, args);
    }
}
```

At the **root** of `com.jmorgan.showcase`, above every feature package — component scanning is "this package and everything under it", and one level too deep silently skips siblings.

- [ ] **Step 7: Run the tests and verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=GithubClientTest test 2>&1 | tail -20
```

Expected: PASS, all four tests.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat: GitHub client

RestClient with an optional bearer token from the environment. Base64 file
content decoded server-side; missing files return empty rather than throwing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Sync service

Idempotent ingestion — the transaction boundary and the `@Scheduled` entry point.

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/github/SyncService.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/github/SyncServiceTest.java`

**Interfaces:**
- Consumes: `GithubClient`, `RuleTableParser`, all repositories from Tasks 4, 5, 6, 7
- Produces:
  - `SyncService.syncAll()` — `@Scheduled`, iterates `properties.repos()`
  - `SyncService.syncRepo(String repoFullName)` → `int` (rules synced)
  - `SyncService.latestRun()` → `Optional<SyncRun>`

- [ ] **Step 1: Write the failing sync test**

```java
// backend/src/test/java/com/jmorgan/showcase/github/SyncServiceTest.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.PostgresTestBase;
import com.jmorgan.showcase.catalog.RuleRepository;
import com.jmorgan.showcase.catalog.SkillRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@SpringBootTest
@ActiveProfiles("test")
class SyncServiceTest extends PostgresTestBase {

    private static final String REPO = "j-morgan6/spring-boot-guide";

    private static final String README = """
            | ID | Fires on | Fix | Gating |
            |---|---|---|---|
            | SB005 | eager fetch | use LAZY | none |
            | SB101 | self-invocation | split the bean | none |
            """;

    @MockitoBean
    private GithubClient github;

    private final SyncService sync;
    private final RuleRepository rules;
    private final SkillRepository skills;
    private final SyncRunRepository runs;

    @Autowired
    SyncServiceTest(SyncService sync, RuleRepository rules, SkillRepository skills, SyncRunRepository runs) {
        this.sync = sync;
        this.rules = rules;
        this.skills = skills;
        this.runs = runs;
    }

    private void stubHappyPath() {
        given(github.fetchRepo(REPO)).willReturn(new GithubRepo("spring-boot-guide", "A plugin", "2026-09-17T00:00:00Z"));
        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn(README);
        given(github.listSkillNames(REPO)).willReturn(List.of("transactions"));
        given(github.fetchFile(eq(REPO), eq("skills/transactions/SKILL.md"))).willReturn("# Transactions");
        given(github.fetchCommits(anyString(), anyInt())).willReturn(List.of());
        given(github.fetchContributors(anyString())).willReturn(List.of());
    }

    @Test
    void ingestsRulesAndSkills() {
        stubHappyPath();

        int synced = sync.syncRepo(REPO);

        assertThat(synced).isEqualTo(2);
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide")).hasSize(2);
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide")).hasSize(1);
    }

    @Test
    void isIdempotentAcrossRepeatedSyncs() {
        stubHappyPath();

        sync.syncRepo(REPO);
        Long idAfterFirst = rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getId();

        sync.syncRepo(REPO);

        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide")).hasSize(2);
        assertThat(rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getId())
                .as("an existing rule is updated in place, not deleted and reinserted")
                .isEqualTo(idAfterFirst);
    }

    @Test
    void updatesChangedRuleText() {
        stubHappyPath();
        sync.syncRepo(REPO);

        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn("""
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | SB005 | eager fetch anywhere | use LAZY always | none |
                | SB101 | self-invocation | split the bean | none |
                """);

        sync.syncRepo(REPO);

        assertThat(rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getFixText())
                .isEqualTo("use LAZY always");
    }

    @Test
    void recordsAFailedRunAndLeavesPriorDataInPlace() {
        stubHappyPath();
        sync.syncRepo(REPO);

        given(github.fetchRepo(REPO)).willThrow(new IllegalStateException("connection refused"));

        sync.syncAll();

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();
        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(latest.get().getError()).contains("connection refused");
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide"))
                .as("a failed sync must not wipe good data")
                .hasSize(2);
    }
}
```

`@MockitoBean`, not `@MockBean` — at Boot 4 `@MockBean` is **removed**, and SB019 blocks it. This is one of the rules the Boot 4 choice was made to exercise.

- [ ] **Step 2: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=SyncServiceTest test 2>&1 | tail -20
```

Expected: FAIL — `SyncService` does not exist.

- [ ] **Step 3: Write SyncService**

```java
// backend/src/main/java/com/jmorgan/showcase/github/SyncService.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.activity.Commit;
import com.jmorgan.showcase.activity.CommitRepository;
import com.jmorgan.showcase.activity.Contributor;
import com.jmorgan.showcase.activity.ContributorRepository;
import com.jmorgan.showcase.catalog.Plugin;
import com.jmorgan.showcase.catalog.PluginRepository;
import com.jmorgan.showcase.catalog.Rule;
import com.jmorgan.showcase.catalog.RuleRepository;
import com.jmorgan.showcase.catalog.Skill;
import com.jmorgan.showcase.catalog.SkillRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Ingests the plugin repositories into the database.
 *
 * Upserts on the business key rather than deleting and reinserting: findings
 * reference rule ids, and churning them on every sync would orphan them.
 */
@Service
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);
    private static final int COMMIT_PAGE_SIZE = 30;

    private final GithubClient github;
    private final GithubClientProperties properties;
    private final PluginRepository plugins;
    private final RuleRepository rules;
    private final SkillRepository skills;
    private final CommitRepository commits;
    private final ContributorRepository contributors;
    private final SyncRunRepository runs;

    public SyncService(GithubClient github, GithubClientProperties properties, PluginRepository plugins,
                       RuleRepository rules, SkillRepository skills, CommitRepository commits,
                       ContributorRepository contributors, SyncRunRepository runs) {
        this.github = github;
        this.properties = properties;
        this.plugins = plugins;
        this.rules = rules;
        this.skills = skills;
        this.commits = commits;
        this.contributors = contributors;
        this.runs = runs;
    }

    /**
     * Not @Transactional: each repo commits independently, so one failing repo
     * does not roll back another that already succeeded.
     */
    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "${github.sync-interval}")
    public void syncAll() {
        SyncRun run = runs.save(SyncRun.started(Instant.now()));
        int total = 0;
        try {
            for (String repo : properties.repos()) {
                total += syncRepo(repo);
            }
            run.succeed(Instant.now(), total);
            log.info("Sync succeeded: {} rules across {} repos", total, properties.repos().size());
        } catch (RuntimeException e) {
            run.fail(Instant.now(), e.getMessage());
            log.warn("Sync failed, keeping previous data", e);
        }
        runs.save(run);
    }

    @Transactional
    public int syncRepo(String repoFullName) {
        String slug = repoFullName.substring(repoFullName.indexOf('/') + 1);
        GithubRepo meta = github.fetchRepo(repoFullName);

        Plugin plugin = plugins.findBySlug(slug)
                .orElseGet(() -> plugins.save(new Plugin(slug, slug, repoFullName)));
        if (meta != null) {
            plugin.setDescription(meta.description());
        }
        plugin.setSyncedAt(Instant.now());
        plugins.save(plugin);

        int ruleCount = syncRules(plugin, repoFullName);
        syncSkills(plugin, repoFullName);
        syncCommits(plugin, repoFullName);
        syncContributors(plugin, repoFullName);
        return ruleCount;
    }

    public Optional<SyncRun> latestRun() {
        return runs.findFirstByOrderByStartedAtDesc();
    }

    private int syncRules(Plugin plugin, String repoFullName) {
        List<ParsedRule> parsed = RuleTableParser.parse(github.fetchFile(repoFullName, "README.md"));
        for (ParsedRule p : parsed) {
            String key = plugin.getSlug() + ":" + p.ruleId();
            Rule rule = rules.findByRuleKey(key)
                    .orElseGet(() -> new Rule(plugin, p.ruleId(), p.kind(), p.trigger(), p.fix(), p.gate()));
            rule.update(p.kind(), p.trigger(), p.fix(), p.gate());
            rules.save(rule);
        }
        return parsed.size();
    }

    private void syncSkills(Plugin plugin, String repoFullName) {
        for (String name : github.listSkillNames(repoFullName)) {
            String body = github.fetchFile(repoFullName, "skills/" + name + "/SKILL.md");
            if (body.isEmpty()) {
                continue;
            }
            Skill skill = skills.findBySkillKey(plugin.getSlug() + ":" + name)
                    .orElseGet(() -> new Skill(plugin, name, body));
            skill.updateBody(body);
            skills.save(skill);
        }
    }

    private void syncCommits(Plugin plugin, String repoFullName) {
        for (GithubCommit c : github.fetchCommits(repoFullName, COMMIT_PAGE_SIZE)) {
            if (commits.findBySha(c.sha()).isPresent()) {
                continue;
            }
            String message = c.commit() == null ? "" : firstLine(c.commit().message());
            String authorName = c.commit() == null || c.commit().author() == null
                    ? "" : c.commit().author().name();
            Instant authoredAt = c.commit() == null || c.commit().author() == null
                    ? null : c.commit().author().date();
            String avatar = c.author() == null ? "" : c.author().avatarUrl();
            commits.save(new Commit(plugin, c.sha(), message, authorName, avatar, c.htmlUrl(), authoredAt));
        }
    }

    private void syncContributors(Plugin plugin, String repoFullName) {
        for (GithubContributor c : github.fetchContributors(repoFullName)) {
            Contributor existing = contributors.findByContributorKey(plugin.getSlug() + ":" + c.login())
                    .orElseGet(() -> new Contributor(plugin, c.login(), c.avatarUrl(), c.htmlUrl(), c.contributions()));
            existing.setContributions(c.contributions());
            contributors.save(existing);
        }
    }

    private static String firstLine(String message) {
        if (message == null) {
            return "";
        }
        int newline = message.indexOf('\n');
        return newline < 0 ? message : message.substring(0, newline);
    }
}
```

**Note the SB101 risk here.** `syncAll()` calls `syncRepo(...)` on `this`, and `syncRepo` is `@Transactional` — a self-invocation, so the proxy is bypassed and the transaction never starts. SB101 should flag this, and it would be **right**: the annotation does nothing as written.

Expect the advisory to fire. Resolve it deliberately, record what you did, and note whether the rule's suggested fix (split the bean, or inject a self-proxy) was the one you actually wanted. Splitting `syncRepo` into a separate `RepoSyncer` bean is the cleaner resolution.

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw -q -Dtest=SyncServiceTest test 2>&1 | tail -30
```

Expected: PASS, all four. If `isIdempotentAcrossRepeatedSyncs` fails on the id assertion, the upsert is deleting and reinserting — fix that, not the test.

- [ ] **Step 5: Resolve the SB101 self-invocation finding**

Whatever the advisory reported, act on it — but **keep `syncRepo` on `SyncService`**. Extract only the transactional body into a new `RepoSyncer` bean:

```java
@Service
public class RepoSyncer {
    @Transactional
    public int sync(String repoFullName) { /* the body that was in SyncService.syncRepo */ }
}
```

`SyncService.syncRepo` then delegates: `return repoSyncer.sync(repoFullName);` and drops its own `@Transactional`. The call is now cross-bean, so the proxy applies and the transaction is real.

Keeping the public entry point on `SyncService` matters: this task's tests call `sync.syncRepo(REPO)` and Task 10's `SyncController` injects `SyncService`. Moving the method wholesale would break both.

Re-run the suite. Record the before and after in `docs/spring-plugin-findings.md`, including your verdict on whether SB101 was right.

- [ ] **Step 6: Commit**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: sync service

Idempotent upsert on the business key so findings keep their rule
references. A failed sync records the error and leaves prior data intact.
SB101 self-invocation advisory triaged and resolved.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Catalog API

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/catalog/dto/PluginDto.java`, `RuleDto.java`, `SkillDto.java`, `SkillSummaryDto.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/catalog/CatalogService.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/catalog/CatalogController.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/config/CorsConfig.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/catalog/CatalogControllerTest.java`

**Interfaces:**
- Consumes: repositories from Task 4
- Produces:
  - `PluginDto(String slug, String name, String repoFullName, String description, Instant syncedAt, int ruleCount)`
  - `RuleDto(String ruleId, String kind, String trigger, String fix, String gate)` — `kind` lowercased for the wire
  - `SkillSummaryDto(String name)`, `SkillDto(String name, String body)`
  - `CatalogService.plugins()`, `rules(String slug, String kind, String query)`, `skills(String slug)`, `skill(String slug, String name)`
  - `GET /api/plugins`, `/api/plugins/{slug}/rules`, `/api/plugins/{slug}/skills`, `/api/plugins/{slug}/skills/{name}`

- [ ] **Step 1: Write the DTOs**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/dto/PluginDto.java
package com.jmorgan.showcase.catalog.dto;

import java.time.Instant;

public record PluginDto(String slug, String name, String repoFullName, String description,
                        Instant syncedAt, int ruleCount) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/dto/RuleDto.java
package com.jmorgan.showcase.catalog.dto;

public record RuleDto(String ruleId, String kind, String trigger, String fix, String gate) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/dto/SkillSummaryDto.java
package com.jmorgan.showcase.catalog.dto;

public record SkillSummaryDto(String name) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/dto/SkillDto.java
package com.jmorgan.showcase.catalog.dto;

public record SkillDto(String name, String body) {
}
```

These exist so the controller never names an entity type. SB110 fires when a `@RestController` imports from an `.entity.`/`.domain.model.` package **and** that type appears in a signature — our entities live in `catalog/`, not `catalog/entity/`, so SB110's package heuristic will **not** match. Mapping to DTOs anyway is correct regardless, and whether SB110 misses this layout is itself worth recording as a finding.

- [ ] **Step 2: Write the failing controller test**

```java
// backend/src/test/java/com/jmorgan/showcase/catalog/CatalogControllerTest.java
package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CatalogController.class)
class CatalogControllerTest {

    @MockitoBean
    private CatalogService catalog;

    private final MockMvc mvc;

    @Autowired
    CatalogControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void listsPlugins() throws Exception {
        given(catalog.plugins()).willReturn(List.of(
                new PluginDto("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide",
                        "A plugin", Instant.parse("2026-09-20T00:00:00Z"), 39)));

        mvc.perform(get("/api/plugins"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("spring-boot-guide"))
                .andExpect(jsonPath("$[0].ruleCount").value(39));
    }

    @Test
    void listsRulesForAPlugin() throws Exception {
        given(catalog.rules(eq("spring-boot-guide"), any(), any())).willReturn(List.of(
                new RuleDto("SB005", "blocking", "eager fetch", "use LAZY", "none")));

        mvc.perform(get("/api/plugins/spring-boot-guide/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ruleId").value("SB005"))
                .andExpect(jsonPath("$[0].kind").value("blocking"));
    }

    @Test
    void returns404ForAnUnknownSkill() throws Exception {
        given(catalog.skill("spring-boot-guide", "nope")).willReturn(Optional.empty());

        mvc.perform(get("/api/plugins/spring-boot-guide/skills/nope"))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsASkillBody() throws Exception {
        given(catalog.skill("spring-boot-guide", "transactions"))
                .willReturn(Optional.of(new SkillDto("transactions", "# Transactions")));

        mvc.perform(get("/api/plugins/spring-boot-guide/skills/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("# Transactions"));
    }
}
```

`@WebMvcTest`, not `@SpringBootTest` — SB109 fires on the latter in a `*ControllerTest`, and a slice test is genuinely what this needs: no database, no container, fast.

- [ ] **Step 3: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=CatalogControllerTest test 2>&1 | tail -20
```

Expected: FAIL — `CatalogController` and `CatalogService` do not exist.

- [ ] **Step 4: Write CatalogService**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/CatalogService.java
package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import com.jmorgan.showcase.catalog.dto.SkillSummaryDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final PluginRepository plugins;
    private final RuleRepository rules;
    private final SkillRepository skills;

    public CatalogService(PluginRepository plugins, RuleRepository rules, SkillRepository skills) {
        this.plugins = plugins;
        this.rules = rules;
        this.skills = skills;
    }

    public List<PluginDto> plugins() {
        return plugins.findAll().stream()
                .map(p -> new PluginDto(p.getSlug(), p.getName(), p.getRepoFullName(), p.getDescription(),
                        p.getSyncedAt(), rules.findByPluginSlugOrderByRuleId(p.getSlug()).size()))
                .toList();
    }

    /**
     * Filtering happens here rather than in the controller, and the free-text
     * match covers id, trigger and fix — the same three fields the front end's
     * filter searched before this moved server-side.
     */
    public List<RuleDto> rules(String slug, String kind, String query) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return rules.findByPluginSlugOrderByRuleId(slug).stream()
                .filter(r -> kind == null || kind.isBlank()
                        || r.getKind().name().equalsIgnoreCase(kind))
                .filter(r -> needle.isEmpty()
                        || r.getRuleId().toLowerCase(Locale.ROOT).contains(needle)
                        || r.getTriggerText().toLowerCase(Locale.ROOT).contains(needle)
                        || r.getFixText().toLowerCase(Locale.ROOT).contains(needle))
                .map(CatalogService::toDto)
                .toList();
    }

    public List<SkillSummaryDto> skills(String slug) {
        return skills.findByPluginSlugOrderByName(slug).stream()
                .map(s -> new SkillSummaryDto(s.getName()))
                .toList();
    }

    public Optional<SkillDto> skill(String slug, String name) {
        return skills.findBySkillKey(slug + ":" + name)
                .map(s -> new SkillDto(s.getName(), s.getBody()));
    }

    private static RuleDto toDto(Rule rule) {
        return new RuleDto(
                rule.getRuleId(),
                rule.getKind().name().toLowerCase(Locale.ROOT),
                rule.getTriggerText(),
                rule.getFixText(),
                rule.getGateText());
    }
}
```

`@Transactional(readOnly = true)` at class level, on a **public** class with public methods — SB003 blocks the annotation on a private or package-private method, and a read-only boundary is right for a query service regardless.

- [ ] **Step 5: Write CatalogController**

```java
// backend/src/main/java/com/jmorgan/showcase/catalog/CatalogController.java
package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import com.jmorgan.showcase.catalog.dto.SkillSummaryDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plugins")
public class CatalogController {

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public List<PluginDto> plugins() {
        return catalog.plugins();
    }

    @GetMapping("/{slug}/rules")
    public List<RuleDto> rules(@PathVariable String slug,
                               @RequestParam(required = false) String kind,
                               @RequestParam(required = false) String q) {
        return catalog.rules(slug, kind, q);
    }

    @GetMapping("/{slug}/skills")
    public List<SkillSummaryDto> skills(@PathVariable String slug) {
        return catalog.skills(slug);
    }

    @GetMapping("/{slug}/skills/{name}")
    public ResponseEntity<SkillDto> skill(@PathVariable String slug, @PathVariable String name) {
        return catalog.skill(slug, name)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
```

A class-level `@RequestMapping("/api/plugins")` with **no** `method` attribute does not fire SB009 — the rule targets `method =` in the argument list. Every handler uses `@GetMapping`. No repository is referenced, no `@Transactional` appears, and the file is well under 120 lines (SB113, SB004).

- [ ] **Step 6: Write CorsConfig**

```java
// backend/src/main/java/com/jmorgan/showcase/config/CorsConfig.java
package com.jmorgan.showcase.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The one genuinely application-wide concern, which is why it lives in config/
 * rather than beside a feature.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:4200")
                .allowedMethods("GET");
    }
}
```

Origins are enumerated — SB105 fires on `allowedOrigins("*")`, and a wildcard would be wrong for a service that will eventually carry a token.

- [ ] **Step 7: Run the tests and verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=CatalogControllerTest test 2>&1 | tail -20
```

Expected: PASS, all four tests.

- [ ] **Step 8: Dispatch the architecture review agent**

Dispatch `spring-boot-guide:spring-architecture-review` against `backend/src/main/java/`. It checks layer boundaries — exactly what this task introduced. Triage every finding into the log.

- [ ] **Step 9: Commit**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: catalog API

Read-only endpoints for plugins, rules and skills. DTO records at the
boundary, filtering in the service, CORS enumerated. spring-architecture-review
dispatched and triaged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Activity, findings, and sync-status API

**Files:**
- Create: `backend/src/main/java/com/jmorgan/showcase/activity/dto/CommitDto.java`, `ContributorDto.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/activity/ActivityService.java`, `ActivityController.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/finding/dto/FindingDto.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/finding/FindingService.java`, `FindingController.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/dto/SyncStatusDto.java`
- Create: `backend/src/main/java/com/jmorgan/showcase/github/SyncController.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/activity/ActivityControllerTest.java`
- Create: `backend/src/test/java/com/jmorgan/showcase/github/SyncControllerTest.java`

**Interfaces:**
- Consumes: repositories from Task 5, `SyncService.latestRun()` from Task 8
- Produces:
  - `CommitDto(String sha, String message, String authorName, String authorAvatarUrl, String url, Instant authoredAt)`
  - `ContributorDto(String login, String avatarUrl, String url, int contributions)`
  - `FindingDto(String ruleId, String pluginSlug, String filePath, String verdict, String why, String action, Instant recordedAt)`
  - `SyncStatusDto(String status, Instant startedAt, Instant finishedAt, int rulesSynced, String error, boolean stale)`
  - `GET /api/plugins/{slug}/activity/commits`, `/contributors`, `GET /api/findings`, `GET /api/sync/status`

- [ ] **Step 1: Write the activity DTOs**

```java
// backend/src/main/java/com/jmorgan/showcase/activity/dto/CommitDto.java
package com.jmorgan.showcase.activity.dto;

import java.time.Instant;

public record CommitDto(String sha, String message, String authorName, String authorAvatarUrl,
                        String url, Instant authoredAt) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/activity/dto/ContributorDto.java
package com.jmorgan.showcase.activity.dto;

public record ContributorDto(String login, String avatarUrl, String url, int contributions) {
}
```

- [ ] **Step 2: Write the failing activity controller test**

```java
// backend/src/test/java/com/jmorgan/showcase/activity/ActivityControllerTest.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ActivityController.class)
class ActivityControllerTest {

    @MockitoBean
    private ActivityService activity;

    private final MockMvc mvc;

    @Autowired
    ActivityControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void listsCommits() throws Exception {
        given(activity.commits("angular-guide")).willReturn(List.of(
                new CommitDto("abc1234", "feat: something", "j", "", "", Instant.parse("2026-09-10T00:00:00Z"))));

        mvc.perform(get("/api/plugins/angular-guide/activity/commits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sha").value("abc1234"))
                .andExpect(jsonPath("$[0].message").value("feat: something"));
    }

    @Test
    void listsContributors() throws Exception {
        given(activity.contributors("angular-guide")).willReturn(List.of(
                new ContributorDto("j-morgan6", "https://avatars/1", "https://github.com/j", 120)));

        mvc.perform(get("/api/plugins/angular-guide/activity/contributors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].login").value("j-morgan6"))
                .andExpect(jsonPath("$[0].contributions").value(120));
    }

    @Test
    void returnsAnEmptyArrayForAnUnknownPlugin() throws Exception {
        given(activity.commits("nope")).willReturn(List.of());

        mvc.perform(get("/api/plugins/nope/activity/commits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
```

- [ ] **Step 3: Run it and verify it fails**

```bash
cd backend && ./mvnw -q -Dtest=ActivityControllerTest test 2>&1 | tail -20
```

Expected: FAIL — the activity service and controller do not exist.

- [ ] **Step 4: Write ActivityService and ActivityController**

```java
// backend/src/main/java/com/jmorgan/showcase/activity/ActivityService.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ActivityService {

    private final CommitRepository commits;
    private final ContributorRepository contributors;

    public ActivityService(CommitRepository commits, ContributorRepository contributors) {
        this.commits = commits;
        this.contributors = contributors;
    }

    public List<CommitDto> commits(String slug) {
        return commits.findByPluginSlugOrderByAuthoredAtDesc(slug).stream()
                .map(c -> new CommitDto(c.getSha(), c.getMessage(), c.getAuthorName(),
                        c.getAuthorAvatarUrl(), c.getUrl(), c.getAuthoredAt()))
                .toList();
    }

    public List<ContributorDto> contributors(String slug) {
        return contributors.findByPluginSlugOrderByContributionsDesc(slug).stream()
                .map(c -> new ContributorDto(c.getLogin(), c.getAvatarUrl(), c.getUrl(), c.getContributions()))
                .toList();
    }
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/activity/ActivityController.java
package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plugins/{slug}/activity")
public class ActivityController {

    private final ActivityService activity;

    public ActivityController(ActivityService activity) {
        this.activity = activity;
    }

    @GetMapping("/commits")
    public List<CommitDto> commits(@PathVariable String slug) {
        return activity.commits(slug);
    }

    @GetMapping("/contributors")
    public List<ContributorDto> contributors(@PathVariable String slug) {
        return activity.contributors(slug);
    }
}
```

- [ ] **Step 5: Write the findings DTO, service and controller**

```java
// backend/src/main/java/com/jmorgan/showcase/finding/dto/FindingDto.java
package com.jmorgan.showcase.finding.dto;

import java.time.Instant;

public record FindingDto(String ruleId, String pluginSlug, String filePath, String verdict,
                         String why, String action, Instant recordedAt) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/finding/FindingService.java
package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.catalog.Rule;
import com.jmorgan.showcase.finding.dto.FindingDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class FindingService {

    private final FindingRepository findings;

    public FindingService(FindingRepository findings) {
        this.findings = findings;
    }

    public List<FindingDto> findings(String ruleKey) {
        List<Finding> found = (ruleKey == null || ruleKey.isBlank())
                ? findings.findAllByOrderByRecordedAtDesc()
                : findings.findByRuleRuleKey(ruleKey);
        return found.stream().map(FindingService::toDto).toList();
    }

    private static FindingDto toDto(Finding finding) {
        Rule rule = finding.getRule();
        return new FindingDto(
                rule.getRuleId(),
                rule.getPlugin().getSlug(),
                finding.getFilePath(),
                finding.getVerdict().name().toLowerCase(Locale.ROOT),
                finding.getWhy(),
                finding.getAction(),
                finding.getRecordedAt());
    }
}
```

`toDto` walks `finding.getRule().getPlugin().getSlug()`, initializing two lazy proxies per row — an N+1 in the making. It runs inside the read-only transaction so it works, but **this is exactly the shape SB111 and `jpa-review` exist to catch.** Leave it as written for the first run, see whether either flags it, record the answer, and only then fix it with an `@EntityGraph` on `findAllByOrderByRecordedAtDesc`. A rule that misses this is a finding; a rule that catches it is a finding too.

```java
// backend/src/main/java/com/jmorgan/showcase/finding/FindingController.java
package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.finding.dto.FindingDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/findings")
public class FindingController {

    private final FindingService findings;

    public FindingController(FindingService findings) {
        this.findings = findings;
    }

    @GetMapping
    public List<FindingDto> findings(@RequestParam(required = false) String ruleKey) {
        return findings.findings(ruleKey);
    }
}
```

- [ ] **Step 6: Write the sync status DTO and controller**

```java
// backend/src/main/java/com/jmorgan/showcase/github/dto/SyncStatusDto.java
package com.jmorgan.showcase.github.dto;

import java.time.Instant;

/**
 * `stale` is what the front end's degraded state renders: the last run either
 * failed or finished longer ago than one sync interval.
 */
public record SyncStatusDto(String status, Instant startedAt, Instant finishedAt,
                            int rulesSynced, String error, boolean stale) {
}
```

```java
// backend/src/main/java/com/jmorgan/showcase/github/SyncController.java
package com.jmorgan.showcase.github;

import com.jmorgan.showcase.github.dto.SyncStatusDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService sync;
    private final GithubClientProperties properties;

    public SyncController(SyncService sync, GithubClientProperties properties) {
        this.sync = sync;
        this.properties = properties;
    }

    @GetMapping("/status")
    public SyncStatusDto status() {
        return sync.latestRun()
                .map(this::toDto)
                .orElseGet(() -> new SyncStatusDto("never", null, null, 0, null, true));
    }

    private SyncStatusDto toDto(SyncRun run) {
        boolean stale = run.getStatus() != SyncStatus.SUCCEEDED || isOverdue(run.getFinishedAt());
        return new SyncStatusDto(
                run.getStatus().name().toLowerCase(Locale.ROOT),
                run.getStartedAt(),
                run.getFinishedAt(),
                run.getRulesSynced(),
                run.getError(),
                stale);
    }

    private boolean isOverdue(Instant finishedAt) {
        if (finishedAt == null) {
            return true;
        }
        Duration interval = properties.syncInterval();
        return Duration.between(finishedAt, Instant.now()).compareTo(interval.multipliedBy(2)) > 0;
    }
}
```

- [ ] **Step 7: Write the sync controller test**

```java
// backend/src/test/java/com/jmorgan/showcase/github/SyncControllerTest.java
package com.jmorgan.showcase.github;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SyncController.class)
@Import(SyncControllerTest.Props.class)
class SyncControllerTest {

    @TestConfiguration
    static class Props {
        @Bean
        GithubClientProperties githubClientProperties() {
            return new GithubClientProperties("", "https://api.github.com", List.of(), Duration.ofHours(6));
        }
    }

    @MockitoBean
    private SyncService sync;

    private final MockMvc mvc;

    @Autowired
    SyncControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void reportsNeverWhenNoSyncHasRun() throws Exception {
        given(sync.latestRun()).willReturn(Optional.empty());

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("never"))
                .andExpect(jsonPath("$.stale").value(true));
    }

    @Test
    void marksAFailedRunStale() throws Exception {
        SyncRun run = SyncRun.started(Instant.now().minusSeconds(60));
        run.fail(Instant.now(), "connection refused");
        given(sync.latestRun()).willReturn(Optional.of(run));

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("failed"))
                .andExpect(jsonPath("$.stale").value(true))
                .andExpect(jsonPath("$.error").value("connection refused"));
    }

    @Test
    void marksARecentSuccessFresh() throws Exception {
        SyncRun run = SyncRun.started(Instant.now().minusSeconds(60));
        run.succeed(Instant.now(), 39);
        given(sync.latestRun()).willReturn(Optional.of(run));

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("succeeded"))
                .andExpect(jsonPath("$.stale").value(false))
                .andExpect(jsonPath("$.rulesSynced").value(39));
    }
}
```

- [ ] **Step 8: Run the whole suite**

```bash
cd backend && ./mvnw -q test 2>&1 | tail -30
```

Expected: PASS, every test.

- [ ] **Step 9: Verify the API against real data**

Start Postgres and run the app **in a separate terminal you control** — never from the agent session, which BG004 blocks precisely because `spring-boot:run` never exits:

```bash
cd backend && docker compose up -d
```

Then, in your own terminal: `./mvnw spring-boot:run`. Once it is up:

```bash
curl -s localhost:8080/api/sync/status | python3 -m json.tool
curl -s localhost:8080/api/plugins | python3 -m json.tool
curl -s "localhost:8080/api/plugins/spring-boot-guide/rules?kind=blocking" | python3 -m json.tool | head -30
```

Expected: the sync has run, both plugins are present, and `spring-boot-guide` reports its rules. Rule counts should match the plugin READMEs — 30 for angular-guide, 39 for spring-boot-guide. A mismatch means the parser missed a table; fix the parser and add the failing case to `RuleTableParserTest`.

- [ ] **Step 10: Commit**

```bash
git add backend docs/spring-plugin-findings.md
git commit -m "feat: activity, findings and sync-status endpoints

Completes the read-only API. Sync status carries a stale flag that the
front end renders as its degraded state.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Front end — API service and rules route

**Files:**
- Create: `frontend/src/app/core/api/showcase.types.ts`, `showcase-api.ts`
- Create: `frontend/src/app/core/api/showcase-api.spec.ts`
- Create: `frontend/proxy.conf.json`
- Modify: `frontend/angular.json` (dev-server proxy)
- Modify: `frontend/src/app/features/rules/rules-page.ts`, `rules-page.spec.ts`, `rule-card.ts`, `rule-filters.ts`
- Delete: `frontend/src/app/core/parsing/rules.ts`, `rules.spec.ts`

**Not deleted in this task** (see Step 8): `core/github/` and `core/parsing/base64.ts` are
still consumed by `skills-page`, `activity-page` and `github-api` itself. They go in Task 12,
once nothing imports them. Deleting them here would break the build and make this task's own
gate — a passing suite — unmeetable.

**Interfaces:**
- Consumes: `GET /api/plugins/{slug}/rules` from Task 9, `GET /api/sync/status` from Task 10
- Produces:
  - `Rule { ruleId, kind, trigger, fix, gate }`, `RuleKind = 'bash' | 'blocking' | 'advisory'`
  - `SyncStatus { status, startedAt, finishedAt, rulesSynced, error, stale }`
  - `ShowcaseApi` — `rules`, `skills`, `commits`, `contributors`, `syncStatus` resources; `skillDoc(Signal<string | undefined>)`; `isStale: Signal<boolean>`

- [ ] **Step 1: Write the wire types**

```typescript
// frontend/src/app/core/api/showcase.types.ts
export type RuleKind = 'bash' | 'blocking' | 'advisory';

export interface Rule {
  readonly ruleId: string;
  readonly kind: RuleKind;
  readonly trigger: string;
  readonly fix: string;
  readonly gate: string;
}

export interface SkillSummary {
  readonly name: string;
}

export interface SkillDoc {
  readonly name: string;
  readonly body: string;
}

export interface Commit {
  readonly sha: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string;
  readonly url: string;
  readonly authoredAt: string;
}

export interface Contributor {
  readonly login: string;
  readonly avatarUrl: string;
  readonly url: string;
  readonly contributions: number;
}

export interface SyncStatus {
  readonly status: 'never' | 'running' | 'succeeded' | 'failed';
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly rulesSynced: number;
  readonly error: string | null;
  readonly stale: boolean;
}
```

- [ ] **Step 2: Write the failing API service test**

```typescript
// frontend/src/app/core/api/showcase-api.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ShowcaseApi } from './showcase-api';

describe('ShowcaseApi', () => {
  let api: ShowcaseApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ShowcaseApi],
    });
    api = TestBed.inject(ShowcaseApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests rules from the backend, not from GitHub', () => {
    TestBed.tick();
    const req = http.expectOne('/api/plugins/spring-boot-guide/rules');
    expect(req.request.method).toBe('GET');
    expect(req.request.url).not.toContain('api.github.com');

    req.flush([{ ruleId: 'SB005', kind: 'blocking', trigger: 'eager', fix: 'lazy', gate: 'none' }]);
    TestBed.tick();

    expect(api.rules.value().map((r) => r.ruleId)).toEqual(['SB005']);
  });

  it('reports stale when the sync status says so', async () => {
    TestBed.tick();
    http.expectOne('/api/plugins/spring-boot-guide/rules').flush([]);
    http.expectOne('/api/sync/status').flush({
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      rulesSynced: 0,
      error: 'connection refused',
      stale: true,
    });
    TestBed.tick();
    expect(api.isStale()).toBe(true);
  });
});
```

Adjust the expected URL list to match whichever resources the service creates eagerly — `http.verify()` will name any request you did not expect, which is the point.

- [ ] **Step 3: Run it and verify it fails**

```bash
cd frontend && npm test -- --watch=false showcase-api 2>&1 | tail -20
```

Expected: FAIL — `ShowcaseApi` does not exist.

- [ ] **Step 4: Write ShowcaseApi**

```typescript
// frontend/src/app/core/api/showcase-api.ts
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
 * The plugin this dashboard reports on. The backend serves several; the UI
 * shows one at a time and this is the default.
 */
const PLUGIN = 'spring-boot-guide';
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
```

- [ ] **Step 5: Configure the dev proxy**

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false
  }
}
```

Save as `frontend/proxy.conf.json`, then add it to the serve target in `frontend/angular.json`:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  },
  "configurations": {
    "production": { "buildTarget": "showcase:build:production" },
    "development": { "buildTarget": "showcase:build:development" }
  },
  "defaultConfiguration": "development"
}
```

The existing `serve` target has no `options` block — add one; do not replace the `configurations` block.

- [ ] **Step 6: Rewrite the rules page**

Read the current file first — the filter and template are being kept, only the data source changes:

```bash
cat frontend/src/app/features/rules/rules-page.ts
```

Then change:
- `inject(GithubApi)` → `inject(ShowcaseApi)`
- the `rules()` computed: was `parseRulesOrThrow(api.readme.value())`, now just `api.rules.value()`
- `api.readme.isLoading()` → `api.rules.isLoading()`
- `api.readme.reload()` → `api.rules.reload()`
- the `<error-state>` binding: `[rateLimited]="api.isRateLimited()"` → `[stale]="api.isStale()"`, `[resetAt]="api.rateLimitResetAt()"` → `[syncError]="api.syncError()"`
- `rule.id` → `rule.ruleId` in the template `track` and in `rule-card.ts`
- `RuleParseError` handling is deleted — parse failures are now the server's problem and surface as a 5xx

Keep the filter logic, the `@empty` block, and the styles exactly as they are.

- [ ] **Step 7: Add the new error-state inputs additively**

```bash
cat frontend/src/app/ui/state/error-state.ts
```

**Add** `stale` and `syncError` as optional inputs alongside the existing `rateLimited` and `resetAt`:

```typescript
readonly stale = input(false);
readonly syncError = input<string | undefined>(undefined);
```

Render the degraded banner when **either** `rateLimited()` or `stale()` is true, preferring the `syncError()` text when present.

Do **not** remove `rateLimited`/`resetAt` here — `skills-page` and `activity-page` still bind them until Task 12, and removing them now breaks the build. Task 12 removes them once nothing binds them. Add one `error-state.spec.ts` test for the stale case; keep the existing tests.

- [ ] **Step 8: Delete only the rules parser**

`rules-page` was its only consumer, and Step 6 just removed that import:

```bash
cd frontend && git rm src/app/core/parsing/rules.ts src/app/core/parsing/rules.spec.ts
```

Leave `core/github/` and `core/parsing/base64.ts` alone — Task 12 removes them after rewiring the last two pages.

Do **not** delete `core/parsing/markdown.ts`, its spec, the `__fixtures__` directory, or anything under `ui/markdown/`. Those carry the NG014 claim and stay.

- [ ] **Step 9: Run the front-end suite**

```bash
cd frontend && npm test -- --watch=false 2>&1 | tail -30
```

Expected: PASS. The count will be **lower** than the 82-test Task 1 baseline — the rules-parser suite moved to Java — and higher by the one new `error-state` stale test and the `showcase-api` tests. Confirm the delta is accounted for by exactly those files and nothing else regressed.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: front end reads from the backend

ShowcaseApi replaces GithubApi; rule parsing and base64 decoding now live
server-side and their front-end copies are deleted. The rate-limited state
becomes a stale-data state. Markdown rendering is untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Front end — skills and activity routes

**Files:**
- Modify: `frontend/src/app/features/skills/skills-page.ts`, `skills-page.spec.ts`
- Modify: `frontend/src/app/features/activity/activity-page.ts`, `activity-page.spec.ts`, `commit-list.ts`, `contributor-card.ts`

**Interfaces:**
- Consumes: `ShowcaseApi` from Task 11
- Produces: no new types

- [ ] **Step 1: Read both pages before changing them**

```bash
cat frontend/src/app/features/skills/skills-page.ts
cat frontend/src/app/features/activity/activity-page.ts
```

- [ ] **Step 2: Rewrite the skills page data source**

Changes:
- The hardcoded nine-element `SKILLS` array is deleted. The skill list now comes from `api.skills.value()`, which means adding a skill to the plugin shows up without a code change — the same live-data principle the rules route already had.
- `api.skillDoc(selected)` now returns a `SkillDoc` object, so the template renders `doc.value()?.body` rather than the raw string.
- `isRateLimitedResource` / `rateLimitResetOf` imports are gone; use `api.isStale()` and `api.syncError()`.

Keep `lexMarkdown`, `stripFrontmatter`, and `<md-view [tokens]>` exactly as they are — the token renderer is the point of this route.

- [ ] **Step 3: Rewrite the activity page data source**

Changes:
- `api.commits` and `api.contributors` now return the backend's shapes: `authoredAt` replaces `date`, and the `sha` arrives **full-length** from the API rather than pre-truncated to 7 characters.
- Truncate in the template — `{{ commit.sha.slice(0, 7) }}` — or add a `shortSha` computed. Do not truncate server-side; the full sha is the useful value to store and link.
- Replace the rate-limit bindings with `[stale]`/`[syncError]` as in Task 11.

`contributor-card.ts` keeps its avatar binding exactly as is. (Earlier drafts of this plan claimed an existing NG104 finding here; there is none. The NG104 block in the 2026-09-10 design doc was an *illustrative example* of the findings-entry format, not a recorded finding, and the component already uses `[ngSrc]`, so NG104 cannot fire on it. Left untouched simply because it is out of scope.)

- [ ] **Step 4: Update both specs**

The existing specs assert loading, rate-limited, failed and empty states through the rendered template. Keep all four shapes; rewrite the rate-limited case as a stale case, flushing a `syncStatus` response with `stale: true` instead of a 403 with `x-ratelimit-remaining: 0`.

- [ ] **Step 5: Run the full front-end suite**

```bash
cd frontend && npm test -- --watch=false 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 6: Verify the whole thing end to end**

With Postgres up and the backend running in your own terminal:

```bash
cd frontend && npm start
```

Open `http://localhost:4200` and check all three routes render from the backend. Then stop the backend and reload: the UI must show the failed state with a retry, not a blank page or a console error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: skills and activity routes read from the backend

The skill list is no longer hardcoded — it comes from the API, so a new
plugin skill appears without a code change. Markdown rendering unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Deployment configuration

Written, buildable, not deployed — per the spec's deployment decision. This task exists because writing it is what exercises the configuration rules.

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`
- Modify: `backend/compose.yaml` (add the app service — the file Task 3 created)
- Modify: `README.md` (how to run both halves)
- Modify: `.github/workflows/*.yml` (add a backend build job)

**Interfaces:**
- Consumes: everything
- Produces: `docker build` produces a runnable image

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src/ src/
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /build/target/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

Dependencies are resolved before the source is copied, so a source-only change does not re-download the world. The image runs as a non-root user.

- [ ] **Step 2: Write .dockerignore**

```
target/
.mvn/wrapper/maven-wrapper.jar
*.iml
.idea/
```

- [ ] **Step 3: Add the app service to compose**

```yaml
  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/showcase
      GITHUB_TOKEN: ${GITHUB_TOKEN:-}
    ports:
      - "8080:8080"
```

`GITHUB_TOKEN` passes through from the host environment and defaults to empty — never a literal. SB012 covers `src/main/resources/` only, so a literal here would **not** be caught: that gap is worth recording as a finding ("rules that should have fired and did not").

- [ ] **Step 4: Verify the image builds**

```bash
cd backend && docker build -t showcase-backend . 2>&1 | tail -15
```

Expected: build succeeds. The image is not pushed and not deployed.

- [ ] **Step 5: Update the README**

Document, concisely: the `frontend/` + `backend/` layout, how to start Postgres, how to run the backend (in a terminal, not from an agent session — BG004), how to run the front end, and that `GITHUB_TOKEN` is optional but raises the unauthenticated rate limit during sync.

- [ ] **Step 6: Add the backend build to CI**

Add a job that runs `./mvnw -B verify` in `backend/`. It needs a Docker service for Testcontainers — on GitHub-hosted runners, Docker is already available, so no extra service block is required. Keep the existing Pages job for the front end.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Dockerfile, compose app service, CI backend job

Buildable and runnable locally; nothing is deployed. Secrets pass through
the environment.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Findings synthesis

The deliverable. Everything before this was the vehicle.

**Files:**
- Modify: `docs/spring-plugin-findings.md`
- Modify: `docs/plugin-findings.md` (the coexistence entries)

**Interfaces:**
- Consumes: every finding recorded during Tasks 1–13
- Produces: a prioritized fix list for `spring-boot-guide` v1.1

- [ ] **Step 1: Dispatch all three review agents against the finished backend**

Run each against `backend/src/main/java/`, separately:

- `spring-boot-guide:spring-architecture-review`
- `spring-boot-guide:spring-project-structure`
- `spring-boot-guide:jpa-review`

Triage every finding into the log with a verdict, including the ones you think are wrong — especially those. Success criterion 5 requires all three to have run against real code.

- [ ] **Step 2: Audit which rules never fired**

Go through all 39 rules in `spring-boot-guide`'s README. For each, record one of: **fired** (with a link to the entry), **could not fire here** (the pattern never occurred — e.g. SB010 password encoders, SB016 empty catch), or **should have fired and did not**.

The third category is the most valuable output of the whole exercise, and the one the mutation gate structurally cannot produce. Known candidates to check deliberately:

- **SB110** — our entities live in `catalog/`, not `catalog/entity/`, so the package heuristic likely never matched. Verify by checking whether it ever fired.
- **SB111** — the `FindingService.toDto` lazy walk in Task 10 is an N+1 shape spanning service and entity. Did it fire? It is documented as same-file and best-effort, so probably not.
- **SB012** — a literal token in `compose.yaml` is outside `src/main/resources/` and outside the rule's scope.

- [ ] **Step 3: Write the synthesis section**

Append to `docs/spring-plugin-findings.md`:

```markdown
## Synthesis

### Tally
| Verdict | Count |
|---|---|
| True positive | |
| False positive | |
| Noise | |
| Should have fired, did not | |

### Prioritized fix list for v1.1
| Priority | Rule | Change | Evidence |
|---|---|---|---|

### Coverage
Rules that fired: …
Rules that could not fire in this codebase: …
Rules that should have fired and did not: …

### Verdicts on the design's open questions
- **Plugin coexistence:** …
- **Detection after the restructure:** …
- **Agent value:** did the three review agents find anything the hooks did not?
```

Fill every cell. An empty false-positive column is a real result and should be stated as one, not left blank.

- [ ] **Step 4: Record the coexistence verdict in the angular-guide log**

Append to `docs/plugin-findings.md` whether the two plugins interfered: did angular-guide's hooks fire on Java files, did spring-boot-guide's fire on TypeScript, did both profiles coexist, and did the `SessionStart` detectors conflict.

Include the BG005 false positive already observed while writing this plan: the Bash guard scanned a heredoc document body containing the words for a recursive delete and a lockfile path, and blocked writing a **planning document**. That is the same shape as the existing BG004 commit-message entry, which suggests a general fix — the guard should not treat heredoc bodies as command text.

- [ ] **Step 5: Run everything one last time**

```bash
cd backend && ./mvnw -q verify 2>&1 | tail -20
cd ../frontend && npm test -- --watch=false 2>&1 | tail -20 && npm run build 2>&1 | tail -5
```

Expected: all green. Report the actual numbers, not an assurance.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: findings synthesis for spring-boot-guide v1.1

Tally, prioritized fix list, coverage audit including rules that should
have fired and did not, and verdicts on plugin coexistence.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the executor

**Record findings as they happen, not afterwards.** A hook firing you fixed three tasks ago is a finding you will describe from memory and get wrong. The verbatim hook output matters — the existing angular-guide log quotes it, and that is what made its BG004 analysis precise enough to act on.

**A blocked write is data, not an obstacle.** The instinct is to work around it and move on. Record it first: rule id, the exact code, the verbatim message, and your verdict on whether the rule was right. A false positive you routed around silently is a finding destroyed.

**Never loosen a rule to make progress.** If a rule blocks something genuinely correct, that is the single most valuable result this exercise can produce. Record it, work around it in a way you would defend in review, and say so in the log.

**Do not run the backend from the agent session.** `./mvnw spring-boot:run` never exits; BG004 blocks it for that reason. Run it in your own terminal.
