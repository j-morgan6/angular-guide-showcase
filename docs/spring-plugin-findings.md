# spring-boot-guide — findings from real-code use

Validating `spring-boot-guide` @ `bd245f0` (v1.0.0) while building the showcase
backend. One entry per hook firing. Verdicts: **true positive** (rule was right),
**false positive** (rule was wrong), **noise** (technically right, not worth the
interruption).

Also recorded: rules that should have fired and did not, and points where a
skill's advice conflicted with what the code actually needed.

---

## Hook firings

### STRUCTURAL — Bash writes bypass every Write|Edit-scoped hook (Tasks 2-5, discovered/fixed in Task 5 review round 1)
**Mechanism, verified in both plugins' `hooks.json`:**
```json
// ~/.claude/plugins/cache/spring-boot-guide/spring-boot-guide/1.0.0/hooks/hooks.json
"PreToolUse": [
  { "matcher": "Bash",       "hooks": [ /* bash-guard.sh — BG001-BG006, inspects command text */ ] },
  { "matcher": "Write|Edit", "hooks": [ /* hook-lint.sh pre  — SB001-SB020 blocking */ ] }
],
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ /* hook-lint.sh post — SB101-SB113 advisory */ ] }
]
```
```json
// ~/.claude/plugins/cache/angular-guide/angular-guide/1.0.0/hooks/hooks.json
"PreToolUse": [
  { "matcher": "Bash",       "hooks": [ /* bash-guard.sh — BG001-BG006 */ ] },
  { "matcher": "Write|Edit", "hooks": [ /* hook-lint.sh pre  — NG001-NG018 blocking */ ] }
],
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ /* hook-lint.sh post — NG101-NG106 advisory */ ] }
]
```
Both plugins scope every entity/code-content rule (SB001-SB020, SB101-SB113,
NG001-NG018, NG101-NG106) to the `Write|Edit` tool matcher, and nothing else.
`Bash` is matched only by `bash-guard.sh`, which inspects the shell command
text (force-push, bare `mvn`, hanging run commands, etc.) — it has no access
to, and never inspects, the content a command writes to disk. A file created
or overwritten via `Bash` (heredoc, `sed`, `cp`, a script) is therefore never
linted by either plugin, in either direction (blocking or advisory), no
matter what it contains. This affects `angular-guide` identically to
`spring-boot-guide` — it is not a `spring-boot-guide`-specific gap.

**Why this is reachable through ordinary tool use, not an edge case:** this
session's own auto-mode guidance actively instructs agents to prefer `Bash`
heredocs/`sed` over the `Write`/`Edit` tools for file changes ("Do your work
through the Bash tool wherever it can accomplish the job... rather than using
the dedicated Read, Edit, or Write tools"). Following that generic guidance
on a Spring Boot or Angular workspace makes the bypass the *default* code
path, not an exotic evasion someone would have to go out of their way to
trigger.

**Evidence — blast radius, measured in Task 5's review fix round:** Tasks 2-4
authored every backend file via `Bash` heredocs, and Task 5 initially did too
before this was caught. That means the "no hooks fired" results recorded
earlier in this file for Task 3's `application.yml` and Task 4's
`Rule.plugin`/`Skill.plugin` meant *never evaluated*, not *evaluated and
clean*. To measure the actual blast radius, every file below was re-written
through the `Write` tool with byte-identical content (Read the file, write
the exact same bytes back), so the hooks would evaluate each one for the
first time:
- all 23 `.java` files under `backend/src/main/java/` and
  `backend/src/test/java/` (`ShowcaseApplication`, the full `catalog`
  package — `Plugin`, `Rule`, `RuleKind`, `Skill`, and their repositories —
  `PostgresTestBase`, `ShowcaseApplicationTests`, `CatalogRepositoryTest`,
  plus the `activity`/`finding`/`github` packages and their tests added in
  Task 5)
- `backend/src/main/resources/application.yml`,
  `application-local.yml`, `application-test.yml`
- `backend/src/main/resources/db/migration/V1__baseline.sql`

**Verbatim hook output during re-verification:** none. No `PreToolUse` block
and no `PostToolUse` advisory output was produced by any of the 27 rewrites.
`git status --porcelain` and `git diff --stat` were both empty immediately
after, confirming every rewrite was byte-identical to what was already
committed (no unintended edit slipped in while reproducing the content), and
`./mvnw test` afterward was still 6/6 green (`ShowcaseApplicationTests`,
`CatalogRepositoryTest` x2, `ActivityRepositoryTest` x2,
`SyncRunRepositoryTest`). So: nothing was actually violating a blocking rule
— Tasks 2-4's code happens to be clean, evaluated on its merits for the first
time here — but that cleanliness was never previously verified by the
plugin; it was assumed.

**Verdict:** should have fired and did not — structural, not a per-rule
defect. No individual SB or NG rule is wrong; the enforcement *surface* has a
gap where an entire, ordinary tool-use path (`Bash` writing files) carries no
coverage at all. Do not read this as "the rules are broken" — every rule that
did evaluate (across Tasks 4 and 5, and now this 27-file re-verification)
behaved exactly as designed once given a chance to run.
**Action:** none for the code — nothing to fix, since re-verification found
no actual violation. Recommended fix, forwarded to the plan rather than
applied here: add a `PostToolUse` hook matched on `Bash` that lints whatever
file(s) the command modified (e.g. diff the command's target paths against
their pre-command state, or re-scan `git status` for changed files under
`backend/src/`). A `PreToolUse` hook on `Bash` cannot do this — it fires
before the command runs and cannot know what an arbitrary shell command will
write, only what the command text says. Until such a hook exists, any future
task must not rely on `Bash`-written files having been linted, and per this
review's fix, `Write`/`Edit` should be treated as required — not merely
preferred — for any file a spring-boot-guide or angular-guide rule can apply
to, overriding the generic Bash-preference guidance for those specific
writes.

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

### SB019 check — `@MockitoBean` in SyncServiceTest (Task 8)
**Code:**
```java
import org.springframework.test.context.bean.override.mockito.MockitoBean;
...
@MockitoBean
private GithubClient github;
```
in `backend/src/test/java/com/jmorgan/showcase/github/SyncServiceTest.java`.
**Verdict:** no firing observed — did not fire, and correctly so.
**Why:** SB019 blocks `@MockBean`, which is removed at Boot 4. `@MockitoBean`
is the Boot 4-correct replacement (confirmed present at
`org.springframework.test.context.bean.override.mockito.MockitoBean` in
`spring-test-7.0.8.jar`, no relocation needed) and is a different annotation,
not merely a renamed alias SB019 also happens to catch — so the write went
through with no `PreToolUse` block and no advisory. This is the outcome the
task explicitly gates on: SB019 must not fire on `@MockitoBean`, and it did
not.
**Action:** none — recorded per the brief's instruction to note the outcome
either way; no false positive and no missed block.

### SB101 — SyncService.syncAll() → this.syncRepo(...) self-invocation (Task 8, deliberate)
**Code (as first written, verbatim from the brief):**
```java
@Scheduled(initialDelayString = "PT5S", fixedDelayString = "${github.sync-interval}")
public void syncAll() {
    ...
    for (String repo : properties.repos()) {
        total += syncRepo(repo);   // self-invocation
    }
    ...
}

@Transactional
public int syncRepo(String repoFullName) { ... }
```
in `backend/src/main/java/com/jmorgan/showcase/github/SyncService.java`.
**Verbatim output:**
```
⚠️  SB101: `@Transactional` method called from inside the same class.
   💡 Fix: Move the transactional method to a separate bean, or inject a proxy of this class into itself.
   Spring applies @Transactional through a proxy that wraps the bean. A call from another method of the same instance goes straight to `this`, bypassing the proxy entirely — so no transaction starts, and no error says so.
   This rule is advisory rather than blocking because overloaded and inherited method names can make it misfire. Verify before changing anything.
   See: transactions skill
```
**Verdict:** true positive.
**Why:** this is exactly the defect the brief planted on purpose. `syncAll()`
calls `syncRepo(...)` on `this`; `syncRepo` carried `@Transactional`. Spring's
proxy-based AOP only intercepts calls that arrive through the bean's proxy —
a same-instance call bypasses it, so the annotation was a no-op. Confirmed
empirically too: with the defect still in place, all four `SyncServiceTest`
tests passed anyway (`./mvnw -Dtest=SyncServiceTest test`, 4/4 green) — the
bug is silent by nature, exactly as SB101's message says ("no error says
so"), and would not have been caught by this test suite without the advisory.
**Fix match:** the rule offered two options — "move the transactional method
to a separate bean" or "inject a proxy of this class into itself." The task
brief's amended Step 5 specifies the first option, with a twist: keep
`syncRepo` as the public entry point on `SyncService` (tests and the future
`SyncController` depend on that name/location) and extract only the
transactional body into a new `RepoSyncer` bean; `SyncService.syncRepo` then
delegates (`return repoSyncer.sync(repoFullName);`) with no `@Transactional`
of its own. That is the suggested fix's first branch, applied at the method
level rather than the whole class — the advisory's phrasing doesn't
anticipate "keep the same public method name and just move the body," but
the underlying mechanism (cross-bean call goes through the proxy) is
identical to what it recommended. The self-proxy alternative was not used;
splitting the bean is the cleaner resolution per the brief.
**Action:** created `backend/src/main/java/com/jmorgan/showcase/github/RepoSyncer.java`
(`@Service`, `@Transactional int sync(String repoFullName)` carrying the body
that used to be in `syncRepo`, plus the four private helper methods it calls).
`SyncService.syncRepo` now reads `return repoSyncer.sync(repoFullName);` and
no longer carries `@Transactional`. Re-verified: writing the fixed
`SyncService.java` produced no SB101 (or any other) advisory output, and
`./mvnw test` is 25/25 green (`./mvnw -Dtest=SyncServiceTest test` is 4/4).

### SB106 — false positive, "github" field vs. package segment collision (Task 8)
**Code:** `private final GithubClient github;` in both
`backend/src/main/java/com/jmorgan/showcase/github/SyncService.java` (before
the Step 5 fix) and `backend/src/main/java/com/jmorgan/showcase/github/RepoSyncer.java`
(after it) — the field is declared `final` in both, exactly as the brief
specifies.
**Verbatim output (fired on both writes):**
```
⚠️  SB106: Constructor-injected field is not `final`.
   💡 Fix: Declare it `private final`.
   `final` documents that the dependency is fixed for the life of the bean and lets the compiler prove nothing reassigns it. It also makes accidental field injection impossible to add later without noticing.
   See: spring-boot-essentials skill
```
**Verdict:** false positive.
**Why:** traced the checker (`check_sb106` in `hook-lint.sh`, `spring-boot-guide` v1.0.0)
by running its embedded Python snippet directly against the written file. For
each constructor-assigned field name, it scans the *entire source file* for
the first line matching `^[^\n;]*\bNAME\s*(?:;|=)` that isn't inside a
method/constructor body, and flags the field if that line lacks `final`. For
the field named `github` in package `com.jmorgan.showcase.github`, the
*first* such match in the file is not the field declaration — it's the
package statement itself: `package com.jmorgan.showcase.github;`. `github`
there is immediately followed by `;`, satisfies the regex, sits outside every
body span, and comes before the real `private final GithubClient github;`
declaration further down the file — so the checker locks onto the package
statement, finds no `final` on it, and flags the field that never had the
problem. Verified directly:
```
$ python3 <embedded check_sb106 snippet> backend/.../SyncService.java
github -> 'package com.jmorgan.showcase.github;' FLAGGED - NOT FINAL
skills -> '    private final SkillRepository skills;' FINAL_OK
...
```
This is a structural bug in the rule, not specific to this file — any class
declaring a field whose name equals the last segment of its own package (here,
literally unavoidable in `com.jmorgan.showcase.github` for anything named
`github`) will falsely trip SB106 regardless of how the field is actually
declared.
**Action:** none — no code change. The field is genuinely `final` in both
files as committed; renaming it to dodge a hook bug would be evading the
rule's intent rather than satisfying it, which the task brief explicitly
prohibits. Recorded so a future plugin fix can special-case package/import
statements out of the "declaration" scan.

### SB113 — 8-parameter constructor on the original SyncService (Task 8, expected)
**Code:** the brief's `SyncService` constructor takes `GithubClient`,
`GithubClientProperties`, `PluginRepository`, `RuleRepository`,
`SkillRepository`, `CommitRepository`, `ContributorRepository`,
`SyncRunRepository` — 8 dependencies.
**Verbatim output:**
```
⚠️  SB113: Constructor takes 8 parameters. Past ~7 dependencies the class is doing several jobs; split it.
   See: component-structure guidance in the project-structure skill
```
**Verdict:** true positive, and resolved as a side effect of the SB101 fix.
**Why:** the brief wrote `SyncService` as a single class doing repo
orchestration, rule/skill/commit/contributor upserts, and run bookkeeping all
at once — exactly the "doing several jobs" shape SB113 warns about. It fired
correctly. Splitting `RepoSyncer` out to resolve SB101 happened to fix this
too: post-split, `SyncService`'s constructor takes 3 parameters
(`GithubClientProperties`, `SyncRunRepository`, `RepoSyncer`) and
`RepoSyncer`'s takes 6 (`GithubClient`, `PluginRepository`, `RuleRepository`,
`SkillRepository`, `CommitRepository`, `ContributorRepository`) — still on
the high side for `RepoSyncer` but under the 7-parameter threshold, and no
SB113 output was produced on either rewritten file.
**Action:** none beyond the SB101 split already performed. Worth noting for a
future task: `RepoSyncer` at 6 dependencies is close enough to the threshold
that adding a 7th (e.g. a `FindingRepository` for a later task) would retrip
SB113 and warrant a further split (e.g. separating skill/commit/contributor
sync from rule sync).

### SB106 — false positive, "catalog" field vs. package segment collision (Task 9)
**Code:** `private final CatalogService catalog;` in
`backend/src/main/java/com/jmorgan/showcase/catalog/CatalogController.java` —
the field is declared `final`, exactly as the brief specifies.
**Verbatim output:**
```
⚠️  SB106: Constructor-injected field is not `final`.
   💡 Fix: Declare it `private final`.
   `final` documents that the dependency is fixed for the life of the bean and lets the compiler prove nothing reassigns it. It also makes accidental field injection impossible to add later without noticing.
   See: spring-boot-essentials skill
```
**Verdict:** false positive — the exact same mechanism recorded for Task 8's
`github`/`GithubClient` field, now reproduced in a different package.
**Why:** `CatalogController` lives in package `com.jmorgan.showcase.catalog`
and injects a field named `catalog` (the `CatalogService`). Per Task 8's
traced mechanism, `check_sb106` scans the whole file for the first line
matching `^[^\n;]*\bNAME\s*(?:;|=)` outside a method/constructor body; for a
field named `catalog` in a package whose last segment is also `catalog`, that
first match is `package com.jmorgan.showcase.catalog;` — not the real
`private final CatalogService catalog;` declaration further down — so the
checker flags a field that was declared `final` all along. Not re-traced with
the embedded Python snippet this time since the mechanism and the file
structure (field name == last package segment, package statement precedes
the real declaration) are identical to the already-diagnosed Task 8 case.
**Action:** none — no code change. The field is genuinely `final` as
committed; renaming it to dodge the hook would evade the rule's intent rather
than satisfy it, which the task brief prohibits. This is the second
independent occurrence of the same structural bug (package-statement line
matching the declaration-scan regex before the real declaration), which
strengthens the case for the Task 8 recommendation: a future plugin fix
should exclude `package`/`import` statement lines from SB106's declaration
scan.

### SB009 — did not fire on `CatalogController`'s class-level `@RequestMapping` (Task 9, expected)
**Code:** `@RequestMapping("/api/plugins")` at class level, with every handler
using `@GetMapping` (no `method =` attribute anywhere) in
`backend/src/main/java/com/jmorgan/showcase/catalog/CatalogController.java`.
**Verdict:** no firing observed — did not fire, correctly.
**Why:** SB009 targets a `method =` attribute inside `@RequestMapping(...)`'s
argument list. The class-level mapping here carries only a path string, no
`method =` attribute, so there was nothing for the rule to match. No false
positive on the bare class-level mapping.
**Action:** none.

### SB110 — did not fire on `CatalogController` (Task 9, expected coverage gap)
**Code:** `CatalogController` returns `PluginDto`/`RuleDto`/`SkillSummaryDto`/
`SkillDto` from `com.jmorgan.showcase.catalog.dto`, never an entity type, so
this is not a case where SB110 *should* have fired regardless of the
heuristic — DTOs at the boundary were the correct design either way.
**Verdict:** did not fire (as expected) — and separately, worth recording
that the package-name heuristic itself would not have caught it even if the
controller had returned entities.
**Why:** SB110 fires when a `@RestController` imports a type from a package
segment `.entity.` or `.domain.model.` and uses it in a signature. This
codebase's entities (`Plugin`, `Rule`, `Skill`) live directly in
`com.jmorgan.showcase.catalog`, not in a `catalog.entity` sub-package — the
feature-first layout the plugin's own `project-structure` skill and
Task 4/Task 9's `spring-project-structure` review both endorse (entities and
repositories held together in one feature package, no `entity`/`repository`
layer folders). Had `CatalogController` mistakenly returned `Rule` or `Skill`
directly from a handler, SB110's package-name heuristic would not have
matched, because `com.jmorgan.showcase.catalog` contains neither `.entity.`
nor `.domain.model.` as a segment.
**Action:** none for this task — the controller never references an entity
type, so there is no live defect to fix. Recorded as a genuine coverage gap:
SB110's heuristic is keyed to a layered-package layout (`entity`/`domain.model`)
that conflicts with the feature-first layout the plugin itself recommends
elsewhere. A future plugin fix should detect "type declared with `@Entity`"
(a semantic check) rather than "type imported from a package literally named
`entity` or `domain.model`" (a naming check), or the rule will stay silent on
every codebase that follows the plugin's own structural advice.

### SB105 — did not fire on `CorsConfig` (Task 9, expected)
**Code:** `registry.addMapping("/api/**").allowedOrigins("http://localhost:4200").allowedMethods("GET");`
in `backend/src/main/java/com/jmorgan/showcase/config/CorsConfig.java`.
**Verdict:** no firing observed — did not fire, correctly.
**Why:** SB105 flags `allowedOrigins("*")`; the origin here is a single
enumerated string, not a wildcard, so there was nothing to match.
**Action:** none.

### SB113 — did not fire on `CatalogController` (Task 9, expected)
**Code:** `CatalogController` holds one field (`CatalogService catalog`), no
`*Repository` type anywhere in the file, and the whole file is 47 lines.
**Verdict:** no firing observed — did not fire, correctly.
**Why:** SB113 fires on a `@RestController` that references a `*Repository`
type directly or exceeds ~120 non-blank lines. Neither condition is present:
the controller depends only on `CatalogService`, and is well under the line
threshold.
**Action:** none.

### SB109 — did not fire on `CatalogControllerTest` (Task 9, expected)
**Code:** `@WebMvcTest(CatalogController.class)` in
`backend/src/test/java/com/jmorgan/showcase/catalog/CatalogControllerTest.java`
(a `*ControllerTest`-named file).
**Verdict:** no firing observed — did not fire, correctly.
**Why:** SB109 fires on `@SpringBootTest` in a `*ControllerTest`/`*ControllerIT`
file. This file uses `@WebMvcTest`, the rule's own recommended fix, so there
was nothing to flag.
**Action:** none.

### SB004 — did not fire on `CatalogController` (Task 9, expected)
**Code:** no `@Transactional` annotation anywhere in
`backend/src/main/java/com/jmorgan/showcase/catalog/CatalogController.java`;
the boundary lives on `CatalogService` instead.
**Verdict:** no firing observed — did not fire, correctly (nothing to block).
**Why:** SB004 blocks `@Transactional` in a file containing `@RestController`.
The controller never declares the annotation, so the rule had nothing to
match — the transaction boundary was placed on `CatalogService`
(`@Transactional(readOnly = true)` at class level) as the brief specified.
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

## Agent reviews (Task 9, Step 8)

`spring-boot-guide:spring-architecture-review` dispatched against
`backend/src/main/java/` (the whole tree, not just the new `catalog`/`config`
additions — 17 production classes across `catalog`, `catalog/dto`,
`activity`, `finding`, `github`, `config`). It checked controller→repository
wiring, entities crossing the web boundary, business logic in controllers,
`@Transactional` placement, and cross-service call chains.

### Finding 1 — `RepoSyncer.sync()` holds a DB transaction open across multiple blocking GitHub HTTP calls
**File:** `backend/src/main/java/com/jmorgan/showcase/github/RepoSyncer.java:52-95`
(Task 8 code, outside Task 9's file list).
**Reported:** `@Transactional int sync(String repoFullName)` calls
`github.fetchRepo(...)`, then `syncRules`/`syncSkills`/`syncCommits`/
`syncContributors`, each making one or more blocking `RestClient` calls
(`syncSkills` in particular loops `github.fetchFile(...)` once per skill) —
all inside the single transactional method, so the JDBC connection and
transaction stay open for the full duration of a scheduled repo crawl,
including any GitHub rate-limit backoff.
**Verdict:** true positive — agree.
**Why:** this is a real and correctly-diagnosed defect: the transaction
boundary drawn to fix Task 8's SB101 self-invocation bug (see the SB101
entry above) is real now, but wider than it needs to be — it wraps I/O that
has nothing to do with the database. The reviewer's own framing ("the
opposite failure mode from the bug this split was built to fix") is accurate.
**Action:** deferred, not fixed in Task 9. `RepoSyncer.java` is not in Task
9's file list (`catalog/dto/*`, `CatalogService`, `CatalogController`,
`config/CorsConfig`, `CatalogControllerTest`), and separating fetch-from-
persist in the sync path is a non-trivial restructuring (splitting
`RepoSyncer.sync()` into an unmanaged fetch phase plus a narrower
`@Transactional` persistence phase) that deserves its own task rather than a
drive-by edit here. Recorded so a future task (sync-service hardening, or
Task 14's final pass) picks this up; the reviewer's suggested fix — fetch
everything via `GithubClient` outside any transaction, then persist
already-fetched data inside a small `@Transactional` method — is a reasonable
starting point.

### Finding 2 — `CatalogService.plugins()` N+1: loads full `Rule` lists just to count them
**File:** `backend/src/main/java/com/jmorgan/showcase/catalog/CatalogService.java:28-33`
(Task 9 code, as originally written verbatim from the brief).
**Reported:** for every plugin from `plugins.findAll()`, a second query loads
the plugin's entire `Rule` list (including `TEXT` columns `trigger_text`/
`fix_text`/`gate_text`) solely to call `.size()` on it. The reviewer
connected this to `docs/spring-plugin-findings.md`'s Task 4 `jpa-review`
forward note ("re-run once a service layer reads Rule/Skill across more than
one plugin per call, check whether `@EntityGraph` is needed") — that
service layer now exists and the predicted shape is present.
**Verdict:** true positive — agree.
**Why:** confirmed by reading `CatalogService.plugins()` as originally
written: `rules.findByPluginSlugOrderByRuleId(p.getSlug()).size()` inside the
`.map(...)` over `plugins.findAll()` is exactly the N+1 shape described, and
fetching full `Rule` rows (four `TEXT` columns each) just to discard
everything but a count is wasteful independent of the N+1 concern.
**Action:** fixed, since this defect lives entirely inside a file Task 9
authored. Added `long countByPluginSlug(String slug);` to
`backend/src/main/java/com/jmorgan/showcase/catalog/RuleRepository.java` and
changed `CatalogService.plugins()` to call
`rules.countByPluginSlug(p.getSlug())` instead of
`.findByPluginSlugOrderByRuleId(p.getSlug()).size()`. This keeps the same
one-query-per-plugin shape (still N+1, not eliminated — the reviewer's
alternative of a single grouped `SELECT plugin_id, COUNT(*) FROM rule GROUP
BY plugin_id` query would remove the N+1 entirely but is a larger change than
warranted here) while dropping the wasted full-row/`TEXT`-column fetch.
Re-verified: writing both edited files produced no `PreToolUse`/`PostToolUse`
hook output, and `./mvnw test` is still 29/29 green afterward.

### Finding 3 (minor/informational) — stale javadoc referencing a nonexistent `SyncController`
**File:** `backend/src/main/java/com/jmorgan/showcase/github/SyncService.java:22-24`
(Task 8 code, outside Task 9's file list).
**Reported:** the class javadoc says `syncRepo` "stays public here ...
because `SyncServiceTest` calls it directly and `SyncController` injects
`SyncService`." No `SyncController` exists anywhere in
`backend/src/main/java/` — the only controller in the codebase is
`CatalogController`, added by this task, and it does not touch `SyncService`.
**Verdict:** true positive on the documentation being stale — agree it no
longer reflects reality now that a controller (`CatalogController`) exists
and isn't the one the comment anticipated.
**Why:** confirmed by reading the javadoc and grepping for `SyncController`
— zero matches anywhere in `backend/src/main/java/`. This is drift, not a
functional defect: the comment was written ahead of a controller that
hadn't landed, and the controller that did land (Task 9's
`CatalogController`) is unrelated to `SyncService`.
**Action:** deferred, not edited in Task 9. `SyncService.java` is outside
Task 9's file list and the fix is purely cosmetic (reword to "a future
controller" or name the actual controller once one calls `SyncService`);
bundling an unrelated doc-only edit to a Task 8 file into this task's commit
would blur the diff. Recorded so whichever task next touches
`SyncService.java` (or adds a controller that calls it) corrects the comment.

### What the review found clean
Controller→repository wiring (only `CatalogController` exists, depends
solely on `CatalogService`), entities never crossing the web boundary (all
four DTOs used consistently, no `@RequestBody` anywhere since every endpoint
is `@GetMapping`), no business logic in `CatalogController` (filtering
correctly lives in `CatalogService.rules()`), `@Transactional` placement on
`CatalogService` (class-level, read-only, correct), and cross-service chains
(`SyncService`→`RepoSyncer` is the only hop in the codebase, one-directional,
intentional). Package organization was reconfirmed consistent with the Task
4 baseline (`catalog` feature-first, `config/CorsConfig` correctly the one
cross-cutting concern outside a feature package).
**Verdict:** true negative on all of the above — agree; nothing to add.
