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

### SB112 / SB005 — Rule.plugin, Skill.plugin `@ManyToOne` (Task 4)
**Code:**
```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "plugin_id", nullable = false)
private Plugin plugin;
```
in `backend/src/main/java/com/jmorgan/showcase/catalog/Rule.java` and
`Skill.java`.
**Verdict:** no firing observed — did not fire (correctly; the rules guard
against the defect, not the presence of `@ManyToOne`)
**Why:** SB112 fires on a bare `@ManyToOne` (implicit EAGER default); SB005
blocks an explicit `FetchType.EAGER`. Both associations were written with an
explicit `fetch = FetchType.LAZY` from the start (per the task brief), so
neither condition was ever present on disk to trigger. Recorded so Task 14's
coverage audit can tell "the guard held because the code never regressed"
apart from "the guard never got exercised."
**Action:** none.

### SB006 — could not fire (Task 4)
**Verdict:** could not fire here
**Why:** the workspace profile reports `lombok: false` for this repo, which
gates SB006 off entirely regardless of what the entity code looks like. Task 4
deliberately writes plain getters/setters and hand-rolled `equals`/`hashCode`
(no Lombok `@Data`/`@Value`) — adding Lombok solely to provoke SB006 would
mean writing code nobody would actually ship. Recorded per the task brief so
Task 14's coverage audit records this as "could not fire here" rather than
"should have fired and did not."
**Action:** none.

---

## Agent reviews (Task 4, Step 9)

Per the task brief, `spring-boot-guide:jpa-review` and
`spring-boot-guide:spring-project-structure` were dispatched against the new
`catalog` package and triaged here exactly like a hook firing, including
findings judged wrong (none were, this round).

### jpa-review — dispatched against backend/src/main/java/com/jmorgan/showcase/catalog/
**Verbatim output (trimmed to findings-relevant text):**
> Bottom line: no defects found in this slice. The three entities are
> well-formed: `equals`/`hashCode` over `slug`/`ruleKey`/`skillKey` (business
> keys, not generated `id`, not all fields) on `Plugin.java:91-105`,
> `Rule.java:53-116`, `Skill.java:71-85`. `Rule.plugin` and `Skill.plugin` are
> both explicitly `@ManyToOne(fetch = FetchType.LAZY, ...)`. Migration
> coverage: every field in `Plugin`, `Rule`, `Skill` maps 1:1 to columns in
> `V1__baseline.sql` (`plugin`, `rule`, `skill` tables), including column name
> overrides, nullability, and uniqueness. No missing/extra field on either
> side.
>
> Not evaluable yet (not a defect): N+1, `@EntityGraph`, and
> `@Transactional(readOnly = true)` concerns require a service/controller
> layer that doesn't exist yet — only `CatalogRepositoryTest` exercises these
> repositories, and current call sites always filter by a single known
> `slug`, so there's no live N+1 shape today. Flagged as a forward-looking
> note for whoever builds the next layer.
>
> Separately: `V1__baseline.sql` also defines `commit_log`, `contributor`,
> `finding`, and `sync_run` tables with no corresponding `@Entity` anywhere in
> the codebase — outside the `catalog` package scope, noted rather than
> flagged as a defect.

**Verdict:** true negative — agree with all three observations.
**Why:** the entity mapping is exactly what the brief specified (explicit
LAZY, business-key equality, 1:1 column mapping), so a clean report is the
correct outcome, not a sign the agent didn't look hard enough — it correctly
distinguished "no defect" from "not yet evaluable" instead of forcing a
finding. The N+1/`@EntityGraph`/`@Transactional` note is accurate and useful:
Task 6+ (whichever task adds the sync service that reads across multiple
plugins) should recheck this once a caller exists that could produce the N+1
shape. The unmapped `commit_log`/`contributor`/`finding`/`sync_run` tables are
correctly out of scope for Task 4 — those are Task 5+'s entities per the
Task 3 migration; not a Task 4 defect.
**Action:** none for Task 4. Forward note carried to the plan: re-run
`jpa-review` once a service layer reads `Rule`/`Skill` across more than one
plugin per call, to check whether `@EntityGraph(attributePaths = "plugin")`
is needed on `findByPluginSlugOrderByRuleId`/`findByPluginSlugOrderByName`.

### spring-project-structure — dispatched against backend/src/main/java/
**Verbatim output (trimmed to findings-relevant text):**
> Findings: none of substance. Package organisation: `com.jmorgan.showcase.catalog`
> holds entities and repositories together (not split into `entity`/`repository`
> layer packages) — a consistent feature-first layout with nothing yet on disk
> to contradict it. Component-scan reachability: `catalog` is a sub-package of
> `com.jmorgan.showcase` (where `ShowcaseApplication` lives), so default
> scanning covers it; repositories are picked up via
> `@EnableJpaRepositories`-implied auto-config, not stereotype scanning.
> Naming consistency: `*Repository` suffix used consistently, entities
> unsuffixed, `RuleKind` correctly unsuffixed. Zero `@Configuration` classes
> yet. Test package mirroring: `CatalogRepositoryTest` mirrors
> `catalog/` correctly. Not a multi-module project.
>
> Proactive note (not a current defect): watch for a later package adopting
> layer-style naming (`controller`/`service`) instead of `catalog`'s feature
> style, and for `@Configuration` classes landing ad-hoc instead of a shared
> `config` package once one is needed.

**Verdict:** true negative — agree.
**Why:** this is the first feature package, so there is genuinely nothing on
disk yet for it to be inconsistent with; a clean report is correct here, not
a sign the check is too weak. The proactive note about later packages
drifting to layer-style naming, and about `@Configuration` classes needing a
home, is worth carrying forward rather than acting on now.
**Action:** none for Task 4. Task 14 re-dispatches this agent against the
finished backend — compare that run's package layout against this baseline
(feature-first, `catalog` holding entity+repository together) and record any
disagreement between the two runs, per the task brief.
