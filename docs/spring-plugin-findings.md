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

### Non-hook finding — stale Testcontainers artifactIds in Task 3 brief (Task 3)
**Code:**
```xml
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
```
**Verbatim hook output:** not a plugin hook — a Maven build failure:
```
[ERROR] 'dependencies.dependency.version' for org.testcontainers:postgresql:jar is missing. @ line 93, column 15
[ERROR] 'dependencies.dependency.version' for org.testcontainers:junit-jupiter:jar is missing. @ line 98, column 15
```
**Verdict:** not applicable (not a rule firing) — recorded because it's a
brief/dependency-currency gap, not a plugin false positive.
**Why:** Boot 4.1.0's parent manages `testcontainers.version` at `2.0.5`
(imported via `testcontainers-bom` in `spring-boot-dependencies`). Testcontainers
2.0 renamed its per-module artifacts with a `testcontainers-` prefix:
`org.testcontainers:postgresql` became `org.testcontainers:testcontainers-postgresql`,
and `org.testcontainers:junit-jupiter` became
`org.testcontainers:testcontainers-junit-jupiter`. The brief's artifactIds are
the pre-2.0 names, which no longer exist in the BOM, so Maven can't resolve a
managed version for them — hence "version is missing" rather than a normal
"artifact not found."
**Action:** used the current artifactIds (`testcontainers-postgresql`,
`testcontainers-junit-jupiter`) with no explicit `<version>`, letting the Boot
parent's `testcontainers-bom` import continue to manage the version. Confirmed
by inspecting `~/.m2/repository/org/testcontainers/testcontainers-bom/2.0.5/testcontainers-bom-2.0.5.pom`,
which lists `testcontainers-postgresql` and `testcontainers-junit-jupiter`
under `dependencyManagement`, not the bare names.

### SB012 check — `github.token: ${GITHUB_TOKEN:}` in application.yml (Task 3)
**Code:** `github.token: ${GITHUB_TOKEN:}` in `backend/src/main/resources/application.yml`
**Verdict:** no firing observed — did not fire (as expected for an environment
reference)
**Why:** SB012 keys on the `token` leaf under `src/main/resources/`, which is
flagged when given a literal secret. `${GITHUB_TOKEN:}` is an environment
placeholder with an empty default, not a literal, so the write went through
with no hook interruption.
**Action:** none — recorded per the brief's instruction to note the outcome
either way; no false positive materialized here.
