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
clean*.

**The exact count (corrected in Task 14 — the earlier "27 rewrites" figure
was wrong).** The re-verification sweep re-wrote **15 files** through the
`Write` tool with byte-identical content (Read the file, write the exact same
bytes back) — these are the files from Tasks 2-4 that had **never** been
linted, and the sweep was the first time any hook evaluated them:

- **11 `.java`** — `ShowcaseApplication`, the Task 4 `catalog` package
  (`Plugin`, `Rule`, `RuleKind`, `Skill`, `PluginRepository`,
  `RuleRepository`, `SkillRepository`), and the Task 2/3 tests
  (`PostgresTestBase`, `ShowcaseApplicationTests`, `CatalogRepositoryTest`)
- **3 `.yml`** — `backend/src/main/resources/application.yml`,
  `application-local.yml`, `application-test.yml`
- **1 `.sql`** — `backend/src/main/resources/db/migration/V1__baseline.sql`

The earlier figure of 27 conflated these 15 with the **12** files Task 5 had
already authored through `Write` in the same task (the `activity`, `finding`
and `github` packages and their tests). Those 12 were linted when they were
written, on their own merits; they were not part of the never-linted
population and must not be counted as evidence for it. **15 is the number
that carries the claim.** The conclusion is unchanged — it is the count that
was wrong, not the finding — but this is the project's headline result, so
the number has to be exact.

**Verbatim hook output during re-verification:** none. No `PreToolUse` block
and no `PostToolUse` advisory output was produced by any of the 15 rewrites.
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
did evaluate (across Tasks 4 and 5, and now this 15-file re-verification)
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

### SB106 check — `CatalogRepositoryTest.countsRulesPerPluginAndZeroForUnknownSlug` (Task 9, review fix round 1)
**Code:** the new test method added to
`backend/src/test/java/com/jmorgan/showcase/catalog/CatalogRepositoryTest.java`
covering `RuleRepository.countByPluginSlug`, following the file's existing
constructor-injection style (fields `plugins`, `rules` unchanged from the
file's Task 4 original).
**Verdict:** no firing observed — did not fire this time.
**Why:** unlike Task 8's `github` field (package `com.jmorgan.showcase.github`)
and Task 9's `catalog` field on `CatalogController` (package
`com.jmorgan.showcase.catalog`), the fields at risk here (`plugins`, `rules`)
don't equal the package's last segment (`catalog`), so the
package-statement-collision mechanism traced in both earlier SB106 entries
had nothing to latch onto. Recorded per the task's instruction to note the
outcome either way — a third occurrence was plausible given the file lives
in the same `catalog` package, but the specific field-name collision that
triggers the bug wasn't present here.
**Action:** none.

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

### SB106 — false positive, "activity" field vs. package segment collision (Task 10)
**Code:** `private final ActivityService activity;` in
`backend/src/main/java/com/jmorgan/showcase/activity/ActivityController.java` —
the field is declared `final`, exactly as the brief specifies.
**Verbatim output:**
```
⚠️  SB106: Constructor-injected field is not `final`.
   💡 Fix: Declare it `private final`.
   `final` documents that the dependency is fixed for the life of the bean and lets the compiler prove nothing reassigns it. It also makes accidental field injection impossible to add later without noticing.
   See: spring-boot-essentials skill
```
**Verdict:** false positive — the same package-statement-collision mechanism
recorded for Task 8's `github`/`GithubClient` field and Task 9's
`catalog`/`CatalogService` field, now reproduced a third time in
`com.jmorgan.showcase.activity`. `check_sb106` scans the whole file for the
first line matching `^[^\n;]*\bNAME\s*(?:;|=)` outside a method/constructor
body; for a field named `activity` in a package whose last segment is also
`activity`, that first match is `package com.jmorgan.showcase.activity;`, not
the real `private final ActivityService activity;` declaration further down.
This is the exact firing the task instructions predicted in advance
("Expect it on a field named ... `activity` in `...activity`"), and it landed
exactly as predicted.
**Negative-case corroboration, same task:** `FindingService`/`FindingController`
in package `com.jmorgan.showcase.finding` both declare a field named
`findings` (plural), not `finding`. Neither write produced any SB106 output —
consistent with the traced mechanism requiring an *exact* string match
between the field name and the package's last segment; `findings` != `finding`
never lets the package-statement line satisfy `\bNAME\b` for that field.
**Action:** none — no code change. The field is genuinely `final` as
committed; renaming it to dodge the hook would evade the rule's intent rather
than satisfy it, which the task brief prohibits. Third independent occurrence
of the same structural bug, further strengthening the case (see Task 8/Task 9
entries above) for a plugin fix that excludes `package`/`import` statement
lines from SB106's declaration scan.

### SB111 — should have fired and did not, on FindingService.toDto's N+1 (Task 10, deliberate experiment)
**Code:** `backend/src/main/java/com/jmorgan/showcase/finding/FindingService.java`,
written verbatim from the brief:
```java
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
            ...
```
`toDto` walks `finding.getRule()` then `.getPlugin().getSlug()` for every row
returned by a repository read — two lazy `@ManyToOne` proxies initialized per
row, a textbook N+1 that only "works" because `FindingService` carries
`@Transactional(readOnly = true)` at class level.
**Verdict:** should have fired and did not.
**Why, traced against the rule's own implementation** (`check_sb111` in
`hook-lint.sh`, `spring-boot-guide` v1.0.0): the check requires (1) a
`.findAll|findBy...|getAll(` call somewhere in the file — present here
(`findAllByOrderByRecordedAtDesc`, `findByRuleRuleKey`) — and (2) a
`for\s*\(\s*TYPE\s+VAR\s*:` loop whose body (next 400 flattened characters)
contains `VAR.getXxx().size()/.stream()/.forEach()/.iterator()`. Our code has
no `for (...)` loop at all — it's `found.stream().map(FindingService::toDto)`,
a method reference over a `Stream` pipeline — so the for-loop regex never
matches anything in the file, the script falls through to its final
`sys.exit(1)`, and `check_sb111`'s `|| return 0` swallows that as "nothing to
report." This is consistent with the rule's documented limits, not beyond
them: its own comment reads "Narrow, same-file, best-effort (spec 11.3): a
repository read, then a for-each whose body walks a collection off the loop
variable. The real case often spans three files and will be missed; widening
this would cost false positives on every correct loop." Two things push our
shape doubly outside that pattern rather than marginally outside it: (a) no
`for` statement exists in the file at all (a `.stream().map()` pipeline is a
different AST shape the regex was never written to see), and (b) even the
body-matching regex is keyed to *collection*-walking terminal calls
(`size`/`stream`/`forEach`/`iterator`) — our leak is a *to-one* lazy-proxy
walk ending in a scalar getter (`.getPlugin().getSlug()`), which is a
different N+1 mechanism (`@ManyToOne` proxy initialization) than the one the
rule's name and message describe ("a collection association walked inside a
loop"). SB111 is architecturally scoped to collection-association N+1, and
this is a to-one-chain N+1; it is arguably outside the rule's intended target
entirely, not just outside its regex's syntactic reach.
**Action:** none yet — left as written per the task's required sequence. The
`jpa-review` agent was dispatched next against this same code (see "Agent
reviews (Task 10, Step 3)" below) before any fix was applied. Following that
agent's confirmation, fixed by adding
`@EntityGraph(attributePaths = {"rule", "rule.plugin"})` to both
`findByRuleRuleKey` and `findAllByOrderByRecordedAtDesc` in
`backend/src/main/java/com/jmorgan/showcase/finding/FindingRepository.java`,
exactly as both the brief and the agent's own suggested fix specify.
Re-verified: writing the edited `FindingRepository.java` produced no
`PreToolUse`/`PostToolUse` hook output, and `./mvnw test` is 36/36 green
afterward (`FindingService`/`FindingController` have no dedicated unit test
of their own in this task — `FindingController`'s handler is exercised only
indirectly via the full-suite compile+boot; the DTO shape and the N+1 fix
itself are covered by the `jpa-review` agent's static analysis rather than a
new repository-level query-count test, which Task 10 does not add).

### SB106 — recurrence, "github" field vs. package segment collision (final fix wave, fix 5/6)
**Code:** every `Edit` of `backend/src/main/java/com/jmorgan/showcase/github/RepoSyncer.java`
during the fix-5 (empty-README-is-a-failure) and fix-6 (upstream-deletion
propagation) changes re-fired:
```
⚠️  SB106: Constructor-injected field is not `final`.
   💡 Fix: Declare it `private final`.
```
**Verdict:** false positive — the same bug already documented above in "SB106
— false positive, 'github' field vs. package segment collision (Task 8)".
`RepoSyncer.java` sits in package `com.jmorgan.showcase.github` and declares
`private final GithubClient github;`; the checker's first-match scan locks
onto the `package com.jmorgan.showcase.github;` statement before it ever
reaches the real (and genuinely `final`) field declaration. Every field in
`RepoSyncer` is `private final` both before and after this wave's edits — no
code change was made in response.
**Action:** none — recorded per the task instruction to log every hook firing
before working around it. No rule was weakened or disabled; this is the same
structural rule bug already on file, now confirmed to retrigger on every
subsequent edit of the one file whose package name and a field name
permanently collide.

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

## Agent reviews (Task 10, Step 3) — SB111 vs. jpa-review on the same N+1

Per the task brief, `spring-boot-guide:jpa-review` was dispatched against
`backend/src/main/java/` with `FindingService.toDto`'s lazy walk still in
place (no `@EntityGraph`, no join fetch) — the exact defect the SB111 entry
above records as a miss. This is the comparison the experiment exists for: a
per-file regex advisory hook versus a cross-file reasoning agent, against the
identical, unmodified code.

### jpa-review — dispatched against backend/src/main/java/ (N+1 still present)
**Verbatim output (trimmed to the primary finding):**
> **1. N+1 in `FindingService.toDto` — the one you flagged, confirmed and
> it's a double N+1**
>
> `Finding.rule` is `@ManyToOne(fetch = LAZY)` (`Finding.java:26-28`), and
> `Rule.plugin` is also `@ManyToOne(fetch = LAZY)` (`Rule.java:25-27`).
> Neither `findAllByOrderByRecordedAtDesc()` nor `findByRuleRuleKey(...)` in
> `FindingRepository.java:9-11` uses a fetch join or `@EntityGraph`. So for a
> result of N findings, `toDto` walks `finding.getRule()` then
> `rule.getPlugin()` for every row, producing up to **2N+1 queries** (1 for
> the findings list, up to N for distinct rules, up to N more for distinct
> plugins) per call to `GET /api/findings` in `FindingController.java:21-24`
> — a plain, unparameterized list endpoint with no pagination. This is the
> textbook cross-file N+1 the single-file SB111-style heuristic can't see:
> the lazy annotation is in `Finding.java`, the second lazy annotation is in
> `Rule.java`, and the loop that dereferences both is in
> `FindingService.java`.
>
> **Fix:** add a fetch join or `@EntityGraph` to both repository methods so
> `rule` and `rule.plugin` are loaded in the same query:
> ```java
> @EntityGraph(attributePaths = {"rule", "rule.plugin"})
> List<Finding> findByRuleRuleKey(String ruleKey);
>
> @EntityGraph(attributePaths = {"rule", "rule.plugin"})
> List<Finding> findAllByOrderByRecordedAtDesc();
> ```

Also reported, lower priority: `Finding` has no `equals`/`hashCode` override
(unlike every other entity in the codebase) — not currently exercised by any
`Set`/`Map` usage, flagged proactively, not urgent; and a write-path N+1 shape
in `RepoSyncer`'s per-loop-iteration lookups, explicitly out of scope for a
read-path mandate and not ranked as a finding. Everything else (fetch
strategy across the whole entity graph, migration-to-entity column mapping,
`@Transactional(readOnly = true)` placement) was checked and reported clean.

**Verdict:** true positive — agree, and the agent's analysis goes further
than the brief's own framing: it correctly identifies this as a *double* N+1
(the `Finding→Rule` hop and the `Rule→Plugin` hop chain together), not a
single one, and correctly locates the unbounded `GET /api/findings` endpoint
as the reason it matters in production rather than treating it as a
theoretical concern.

**Comparison with SB111 (see entry above, same code, same commit-in-progress):**
SB111 did not fire on this exact code — its regex requires an explicit
`for (...)` loop syntax in the same file as the repository call, and our
code is a `.stream().map(methodReference)` pipeline with the dereferencing
logic in a separate `private static` method, so neither the loop-shape check
nor (independently) the collection-terminal-call check
(`size`/`stream`/`forEach`/`iterator`) had anything to match — this N+1 walks
scalar-returning to-one associations, not a collection. jpa-review needed
none of that syntactic scaffolding: it traced the `@ManyToOne(fetch = LAZY)`
declarations in `Finding.java` and `Rule.java`, followed the call chain into
`FindingService.java`, and reasoned about what the JPA runtime actually does
at that call site regardless of loop syntax. This is exactly the shape the
task set out to demonstrate: a same-file, best-effort regex hook is
mechanically blind to an N+1 that spans a `.stream()` pipeline and two
entity files, while a cross-file reasoning agent catches it directly — and,
in this run, characterizes it more precisely (double N+1, unbounded
endpoint) than the SB111 message itself would have.

**Action:** fixed. See the `@EntityGraph` fix recorded in the SB111 entry's
follow-up below.

### SB012 — should have fired and did not, on `GITHUB_TOKEN` in `backend/compose.yaml` (Task 13, scope gap by design)

**Code:** `backend/compose.yaml`, the `app` service added in Task 13:

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

Written with `${GITHUB_TOKEN:-}` passthrough from the host environment —
never a literal value — per the task brief's explicit instruction. This
entry records the scope gap that instruction was flagging, reasoned from the
rule's own implementation rather than from an actual violation: no literal
secret was ever written to test it.

**Verdict:** should have fired and did not (on a hypothetical literal — see
"Why").

**Why, traced against the rule's own implementation** (`hook-lint.sh`,
`spring-boot-guide` v1.0.0) — there are two filters here, and the first,
broader one is what actually stops `backend/compose.yaml`, not the
`check_sb012` function itself.

**First filter — script-level, by basename, `hook-lint.sh:126-134`:**

```bash
EXT=$(printf '%s' "${FILE_PATH##*.}" | tr '[:upper:]' '[:lower:]')
case "$EXT" in java|properties|yml|yaml) ;; *) exit 0 ;; esac

# Config rules only ever apply to Spring's own config files.
case "$EXT" in
  properties|yml|yaml)
    printf '%s' "$(basename "$FILE_PATH")" | grep -q '^application' || exit 0
    ;;
esac
```

This runs before any `check_sbNNN` function is even defined or called, and
it is `exit 0` — terminating the *entire hook script process*, not a
function-local `return`. `backend/compose.yaml` has extension `yaml` (passes
the first `case`), but its basename is `compose.yaml`, which does not match
`^application`, so the second `case` hits `exit 0` and the whole script
exits immediately. `check_sb012`, `check_sb007`, `check_sb013` — every
config-content check the script defines — never runs at all for this file;
they are not reached, skipped, or short-circuited individually, the process
is simply gone before they exist.

**Second filter — function-level, by path, inside each individual check**
(would only matter for a file that clears the first filter):

```bash
is_config()      { case "$EXT" in properties|yml|yaml) return 0 ;; *) return 1 ;; esac; }
is_main_config() { printf '%s' "$FILE_PATH" | grep -q '/src/main/resources/'; }
```

`check_sb012`, `check_sb007`, and `check_sb013` each open with
`is_config || return 0` then `is_main_config || return 0`. For
`backend/compose.yaml` this code is dead — the script-level `exit 0` above
already ended the process — but it is the filter that would apply to a
correctly-named file sitting in the wrong directory, e.g.
`backend/application.yml` living outside `src/main/resources/`.

**The blind spot in its true form:** it is not "config files outside
`src/main/resources/`. It is **any config file whose basename does not
start with `application`, regardless of where it lives** — the basename
gate is checked first and is stricter than the path gate, since it applies
even inside `src/main/resources/`. A file at
`src/main/resources/db-secrets.yml`, correctly placed under Spring's own
config root and containing a literal credential
(`password: hunter2`), would still get **zero** SB007/SB012/SB013 coverage:
its basename `db-secrets.yml` fails `^application` at the script-level
`exit 0` before `is_main_config` — which it would otherwise pass — is ever
reached. `backend/compose.yaml` fails both filters; `db-secrets.yml` in
the correct directory fails only the first, which is enough on its own.
A hypothetical literal `GITHUB_TOKEN: ghp_xxxxxxxxxxxx` written into
`backend/compose.yaml` in place of the `${GITHUB_TOKEN:-}` passthrough
would satisfy the `SECRET` key pattern
(`^(password|secret|token|credential|api[-_.]?key|private[-_.]?key)$`,
`token` is in the alternation) exactly as it would in `application.yml` —
but neither filter is about that pattern matching; both are about whether
the script ever reads the file's content at all.

**Action:** none — no literal secret was written to exploit it. Recorded so
Task 14's coverage audit knows this gap was identified and reasoned through
at the right layer, not missed: the fix that would close it is widening the
script-level basename filter at `hook-lint.sh:126-134` (e.g. to also accept
`compose*.yml`/`docker-compose*.yml`, or dropping the basename requirement
in favor of the existing path-based `is_main_config` check alone) — not
adding directories to `is_main_config`, which a correctly-named,
wrongly-placed file would already satisfy once past the first gate. As
written, any config file not named `application.{properties,yml,yaml}` is
unexamined by every config-content rule (SB007, SB012, SB013), wherever it
sits, and the only thing enforcing the `${GITHUB_TOKEN:-}` passthrough on
`backend/compose.yaml` in practice was following the task brief, not a
hook.

**Bucket correction (Task 14).** This entry is headed "should have fired and
did not", and that overstates what was observed. No literal secret was ever
written anywhere in this repository, so SB012 had nothing to catch and did
not miss anything. The scope gap is real, traced, and worth fixing — but it
is a **demonstrated latent gap reasoned from the rule's own source**, not an
observed miss. Task 14's coverage audit therefore counts SB012 in "could not
fire here (the violating pattern never occurred)" and carries the scope gap
into the v1.1 fix list on its own merits. Keeping it in the "should have
fired" bucket would inflate the single number this exercise exists to
produce.

### SB005 / SB009 — rule-shaped text inside Java string literals did NOT fire (Tasks 4, 6, 9 — verified in Task 14)

**Code:** two linted files contain, as ordinary Java string literals, text
that is a verbatim instance of another rule's trigger pattern:

```java
// backend/src/test/java/com/jmorgan/showcase/catalog/CatalogRepositoryTest.java:33,65
rules.save(new Rule(spring, "SB005", RuleKind.BLOCKING, "FetchType.EAGER", "Use LAZY", "none"));
```
```java
// backend/src/test/java/com/jmorgan/showcase/github/RuleTableParserTest.java:60
String md = "| SB009 | `@RequestMapping(method = …)` | Use `@GetMapping`/`@PostMapping` | none |";
```

**Verdict:** no firing observed — did not fire, correctly. Recorded as a
deliberate true-negative, because the sibling plugin fails the identical test
three times over.

**Why, traced to the implementation:** `hook-lint.sh:218-237` builds
`CODE_PATH`, "the stripped copy every rule matches against", by running
`lib/strip_java.py` over the content — which blanks comments **and string /
char literal content**. Every `check_sbNNN` matches against `CODE_PATH` by
default. A second view, `LITERAL_PATH` (`hook-lint.sh:244-260`), preserves
literal content and is built only for the one rule that needs to see inside
the quotes (SB105, `allowedOrigins("*")`). So the architecture is: literals
are invisible to rules by default, and a rule opts in to seeing them.

`FetchType.EAGER` as a bare string could have tripped a naive SB005; a
`@RequestMapping(method = …)` string could have tripped a naive SB009.
Neither did, because by the time either rule ran, the quoted content was
blanked.

**Why this matters beyond this repository:** the sibling `angular-guide`
plugin, running in the same workspace on the same class of content, produced
**three NG001 false positives** on exactly this shape — rule-trigger text
sitting inside a test fixture's template literal (see
`docs/plugin-findings.md`). That log's own recommended fix reads: "strip
string and template literals before matching, the way comments are already
stripped… would fix this class at the root rather than per-rule."
`spring-boot-guide` already implements precisely that, and this entry is the
empirical proof it works: same hazard, same workspace, same week — zero false
positives on the plugin that strips literals, three on the plugin that does
not. That is a cross-plugin result neither log could produce alone.

**Action:** none — nothing to fix in `spring-boot-guide`. Carried into
`docs/plugin-findings.md` as the concrete precedent for the `angular-guide`
v1.1 recommendation.

### SB110 — should have fired and did not: an `@Entity` crosses into `SyncController` (Task 14, found by `spring-architecture-review`)

**Code:** `backend/src/main/java/com/jmorgan/showcase/github/SyncController.java`
— a `@RestController` — takes the `SyncRun` **entity** as a method parameter
type and reads its state directly:

```java
@RestController
@RequestMapping("/api/sync")
public class SyncController {
    @GetMapping("/status")
    public SyncStatusDto status() {
        return sync.latestRun()          // SyncService.latestRun() -> Optional<SyncRun>
                .map(this::toDto)
                .orElseGet(() -> new SyncStatusDto("never", null, null, 0, null, true));
    }

    private SyncStatusDto toDto(SyncRun run) {   // <-- @Entity as a parameter type
        boolean stale = run.getStatus() != SyncStatus.SUCCEEDED || isOverdue(run.getFinishedAt());
        ...
```

`SyncRun` is annotated `@Entity` (`SyncRun.java:14`). The service hands the
entity out of the transaction (`SyncService.latestRun()` returns
`Optional<SyncRun>`, and `SyncService` carries no `@Transactional` at all),
and the entity-to-DTO mapping — plus the staleness *policy* — lives inside
the controller.

**Verdict:** **should have fired and did not.** This is the single clearest
instance in the project of the exact defect SB110 exists to prevent, sitting
in a file the hook linted, and the rule was silent.

**Why, traced against the rule's own implementation** (`check_sb110`,
`hook-lint.sh`): the check's first act after confirming `@RestController` is
to collect candidate type names from import statements only:

```python
for m in re.finditer(
        r"^[ \t]*import[ \t]+[A-Za-z0-9_.]*\.(?:entity|domain\.model)\.([A-Za-z0-9_]+)[ \t]*;",
        src, re.M):
    names.add(m.group(1))
if not names:
    sys.exit(1)
```

Two independent reasons it could not fire here, and the second is the sharper
one:

1. **The package-name heuristic.** `SyncRun` lives in
   `com.jmorgan.showcase.github`, which contains neither `.entity.` nor
   `.domain.model.` as a segment. This is the gap already recorded in the
   Task 9 SB110 entry above: the plugin's own `project-structure` skill (and
   its own `spring-project-structure` agent, twice) mandates feature-first
   packaging, and following that advice puts every entity outside SB110's
   reach.
2. **Same-package entities produce no import line at all.** `SyncController`
   and `SyncRun` are both in `com.jmorgan.showcase.github`, so the controller
   never writes an `import` for the entity — there is nothing for the regex
   to match, and `names` is empty before the usage check is ever reached.
   **This defeats SB110 even in a codebase that does use `.entity.`
   packages**, whenever the controller sits in the same package as the entity
   it leaks. The rule's own documented limitation ("a project that does not
   use `.entity.` packages gets no coverage") describes only defect 1; defect
   2 is undocumented and independent of naming entirely.

Note the usage condition itself was satisfied — the rule's fix-round
narrowing (the imported simple name must appear as a return or parameter
type, not merely be imported) would have passed, since `SyncRun` is a
parameter type of `toDto`. The rule failed at the import gate, before it ever
got to the check it was refined for.

**How it was found:** not by any hook, and not by me — by
`spring-boot-guide:spring-architecture-review` dispatched in Task 14 (finding
3 of its report, transcribed below), which reasoned across
`SyncController` → `SyncService` → `SyncRun` and named the SB110 blind spot
itself: "The package is `github`, not `entity`, which is exactly the case the
per-file SB110 heuristic cannot see." Second measured instance in this
project of a review agent catching what a per-file regex structurally cannot,
after Task 10's SB111-vs-`jpa-review` result.

**Action:** none applied — Task 14 is a documentation task and the fix
(moving `toDto`/`isOverdue` into `SyncService` and returning `SyncStatusDto`
from it) is a production change outside its file list, recorded below in the
Task 14 agent triage as deferred. The plugin-side fix is in the v1.1 list:
detect "a type declared with `@Entity`" semantically rather than "a type
imported from a package literally named `entity`", which fixes both defects
at once.

---

## Agent reviews (Task 14, Step 1) — all three agents against the finished backend

All three `spring-boot-guide` review agents were dispatched against the
completed `backend/src/main/java/` (45 production classes across `catalog`,
`activity`, `finding`, `github`, `config`, plus their `dto/` sub-packages).
This satisfies the spec's success criterion 5: every review agent has now run
against real code. Each finding is triaged below with my own verdict,
including the ones I judge wrong.

### `spring-architecture-review` — 7 findings

| # | Finding | My verdict |
|---|---|---|
| 1 | `RepoSyncer.sync()` holds a transaction open across every GitHub HTTP call (`RepoSyncer.java:52-70`) | **True positive, already on file** |
| 2 | `github` writes through `catalog`/`activity` repositories and duplicates their business-key derivation | **True positive, new** |
| 3 | `@Entity` (`SyncRun`) crosses into `SyncController`, with staleness policy and config in the web layer | **True positive, new — and the SB110 finding above** |
| 4 | `SyncService` has no transaction boundary; `syncAll` bookkeeping has no `finally` | **True positive, new** |
| 5 | `CatalogService.plugins()` 1+N count queries | **True positive, known and accepted** |
| 6 | Rule filtering done in the JVM rather than the database | **Noise for this codebase** |
| 7 | `SyncService.syncRepo` is a pass-through kept alive by a stale comment | **True positive, partially known** |

**Finding 1 — agree, unchanged.** Independently re-derived, third agent run to
raise it (Task 9's architecture review, Task 10's `jpa-review` note, and now
both Task 14 agents). It remains deferred for the reason ruled in Task 9:
splitting fetch from persist is its own task, not a drive-by edit. The new
detail this run adds is worth keeping — `RestClient` has no configured
connect/read timeout, so the pinned connection is unbounded, not merely long.

**Finding 2 — agree, and this is the most valuable new architectural finding
of the run.** `RepoSyncer` injects five repositories belonging to two other
feature packages, and recomputes their business keys inline
(`plugin.getSlug() + ":" + p.ruleId()` at `RepoSyncer.java:75` duplicating
`Rule.java:56`, and the same shape for `Skill` and `Contributor`). The agent's
account of the failure mode is correct and specific: change the key format in
the entity and the `findByRuleKey` lookups silently stop matching,
`orElseGet` constructs a new row every time, and the sync dies on the
`UNIQUE` constraint at `V1__baseline.sql:14` — in the scheduler, not in a
test. I verified all three duplication sites. No hook in the set can see this
(it spans four files); nor could one reasonably be written to.

**Finding 3 — agree; promoted to its own SB110 entry above.** The agent
identified both the defect and the reason the plugin's own rule missed it.

**Finding 4 — agree, new, and genuinely worth acting on.** `SyncService` is
the only `@Service` with no `@Transactional` at all, and `latestRun()` reads
outside a transaction with `open-in-view: false`. Today that is safe only
because `SyncRun` happens to have no associations — add one lazy field and it
becomes a `LazyInitializationException` during JSON serialization, at
runtime, in production. The `finally`-less bookkeeping in `syncAll()` is a
second real defect: an `Error` or checked exception escaping the loop leaves
the `sync_run` row `RUNNING` forever, which the status endpoint then reports
as permanently stale. Both are outside Task 14's mandate; recorded for a
follow-up task.

**Finding 5 — agree the shape is real, but it is already a recorded,
deliberate decision, not a new defect.** Task 9 fixed the expensive half of
this (loading full `Rule` rows with three `TEXT` columns just to `.size()`
them) by introducing `countByPluginSlug`, and explicitly recorded that the
1+N *shape* remained, the grouped-query alternative being a larger change
than warranted. The agent had no way to know that from the source alone, and
it is right that the shape persists. Not a miss on anyone's part; N is 2.

**Finding 6 — noise.** In-JVM filtering of ~40 rules per plugin is
correctness-neutral and the agent says so itself ("correctness-neutral at ~40
rules per plugin"). Pushing the free-text predicate into a `@Query` would
trade a readable service method for a `like`-concatenation query against
three `TEXT` columns that has no index behind it either. Technically right,
not worth acting on, and not worth the reader's attention at this size — the
definition of noise. Recorded rather than silently dropped.

**Finding 7 — agree on the substance, and it is sharper than the Task 9
version.** Task 9's architecture review flagged the same javadoc as *stale*.
This run goes further and is correct: `SyncController` genuinely never calls
`syncRepo` (verified — it calls only `latestRun()`), so the comment is not
merely out of date, it is false about the present tree, and the only
remaining non-`syncAll` callers are six test assertions. Whether to inline
the method is a judgement call I would leave alone (the indirection is
harmless and the tests are legitimate callers); the comment should be
corrected. Still deferred — `SyncService.java` is outside this task's file
list, and this is now the second task to defer it, which is itself worth
noting.

### `spring-project-structure` — 5 findings, and the baseline held

The agent was given the Task 4 baseline (feature-first, entities and
repositories together, one `config` package) and asked to say whether the
finished tree drifted. **Verdict: it held.** Every package added after Task 4
(`activity`, `finding`, `github`) adopted the same feature-first shape; no
`controller`/`service`/`repository` layer package was ever created; exactly
one `@Configuration` class exists and it is in `config/`. Both of the Task 4
run's proactive watch items came out clean. That is a real result for the
plugin's own structural advice: two agent runs eight tasks apart, consistent
verdicts, no drift.

| # | Finding | My verdict |
|---|---|---|
| 1 | `RepoSyncer` is a `@Service` without the `Service` suffix, beside `SyncService` | **True positive, cosmetic** |
| 2 | GitHub wire records at package root while `github/dto/` exists | **True positive, cosmetic** |
| 3 | `github` is the only package hosting two concerns (integration client + a vertical feature) | **True positive, accepted** |
| 4 | `RepoSyncer` writes through other features' repositories | **True positive — same as architecture finding 2** |
| 5 | `finding` has no test package at all | **True positive, and the most actionable of the five** |

**Findings 1-3 — agree, all cosmetic, none worth a change now.** The naming
and placement inconsistencies are real and correctly identified; the agent is
also right that each is defensible and that the actual defect is the *absence
of a stated reason*, not the choice. Its suggested remedy for all three — a
one-line javadoc or `package-info.java` saying why — is the proportionate
one. Finding 3's full package split is correctly self-flagged as "a real
refactor for a small payoff."

**Finding 4 — agree; the same defect the architecture review raised
independently as its finding 2.** Two agents with different mandates
converging on the same boundary violation from different directions
(structure vs. layering) is corroboration, not duplication. It raises my
confidence that this, not the transaction-across-HTTP issue, is the codebase's
most consequential design flaw.

**Finding 5 — agree, and this is the one I would act on first.** There is no
`backend/src/test/java/com/jmorgan/showcase/finding/` directory at all, while
`catalog`, `activity` and `github` each have controller and/or repository
tests. This was already half-known: Task 10 deferred a minor noting
"no `FindingService`/`FindingController` test". The agent's contribution is
naming exactly what is uncovered — `FindingService.findings(ruleKey)`'s
null/blank branch and the `@RequestParam(required = false)` binding — and
that the `@EntityGraph` fix from Task 10 therefore has **no regression test
guarding it**. That is a genuine hole in this project's own verification, not
just a structural observation.

### `jpa-review` — 10 findings

Dispatched with two explicit verification asks: confirm the Task 10
`@EntityGraph` fix is real and complete, and re-check the two known-unfixed
`RepoSyncer` issues.

**Both verification asks answered, and the answers are load-bearing.** The
agent confirmed `@EntityGraph(attributePaths = {"rule", "rule.plugin"})` is
present on **both** `FindingRepository` methods, that Spring Data expands the
dotted `rule.plugin` into a real subgraph so both lazy hops are satisfied by
the initial select, and — the part I could not have asserted myself without
checking — that `FindingService` lines 23-24 are the **only** call sites and
no inherited `findAll()`/`findById()` is used on findings anywhere, so the
fix has no bypass. **The double N+1 from Task 10 is genuinely gone, verified
independently.** That closes the loop on the project's central experiment.

| # | Finding | My verdict |
|---|---|---|
| 1 | Transaction across GitHub HTTP (`RepoSyncer.java:52-70`) | **True positive — third independent confirmation** |
| 2 | Unbounded `GET /api/findings`, `recorded_at` unindexed | **True positive, new** |
| 3 | Write-path N+1: per-row lookups in all four sync loops, no JDBC batching | **True positive, new and specific** |
| 4 | `CatalogService.plugins()` 1+N counts | **True positive, known** (see architecture finding 5) |
| 5 | Rule filtering in the JVM | **Noise** (same call as architecture finding 6) |
| 6 | Unbounded activity reads, sort columns unindexed | **True positive, new** |
| 7 | `equals` reads `that.field` directly instead of `that.getField()` — broken against a lazy proxy | **True positive, new, and the best finding of the run** |
| 8 | `Finding` and `SyncRun` have no `equals`/`hashCode` | **True positive, partially known** |
| 9 | `SyncService.latestRun()` read path lacks `@Transactional(readOnly = true)` | **True positive — same as architecture finding 4** |
| 10 | Entity `@Column` lengths diverge from the migration's `VARCHAR(n)` | **True positive, low severity** |

**Finding 7 is the standout, and it overturns something this log previously
recorded as clean.** Task 4's `jpa-review` run reported the entities'
`equals`/`hashCode` as "well-formed: `equals`/`hashCode` over
`slug`/`ruleKey`/`skillKey` (business keys, not generated `id`, not all
fields)" and I recorded a true-negative verdict agreeing with it. That
assessment was right about the *key choice* and missed the *access form*. All
five entities do:

```java
return Objects.equals(slug, that.slug);   // Plugin.java:99 — direct field read
```

`that.slug` is a direct field access. When `that` is an uninitialized
Hibernate proxy its own fields are `null` regardless of the underlying row,
so the comparison returns false for two objects representing the same row.
`this.slug` is safe — the proxy intercepts the `equals` call and delegates to
the initialized target — so only the argument side is broken, which is
exactly why it reads as correct. And it is live here rather than theoretical:
**every** `@ManyToOne` in this codebase is `LAZY`, so `rule.getPlugin()`,
`commit.getPlugin()` and `finding.getRule()` all hand out proxies. The fix is
one character class per entity: `that.getSlug()`.

Two things follow. First, **no rule in the 39 comes close to this** — SB005
and SB112 police fetch types, SB006 polices Lombok-generated equality, and
nothing inspects the *body* of a hand-written `equals`. Second, **an agent
run against the same files eight tasks earlier missed it and I ratified that
miss.** Agents are not deterministic checkers and a clean agent report is not
a proof; this is the clearest evidence in the project for that, and it is a
caution against the conclusion that agents simply dominate hooks.

**Findings 2, 3 and 6 — agree, all new, all correctly scoped.** Finding 3 is
the most useful of the three because it is specific rather than generic: four
named loops, each issuing one select and one insert per element, inside the
long transaction from finding 1, with no
`hibernate.jdbc.batch_size` set in `application.yml` (verified — it is not
there). The hoist-the-lookup-into-a-`Map` fix is concrete and correct. Note
that this is the write-path N+1 the Task 10 `jpa-review` run explicitly
declined to rank because its mandate was the read path — so the earlier run
saw it, scoped it out honestly, and this run picked it up when asked for
both. Good agent behaviour in both directions.

**Finding 8 — agree, and it sharpens a note Task 10 recorded as "not
urgent".** The new part is that `Finding` has **no business key available**
to write `equals` over: the `finding` table (`V1__baseline.sql:55-64`) has no
unique constraint on any column or combination, so fixing the equality
requires first deciding what identifies a finding and adding a unique index.
That is a schema decision, not a code tidy-up, which is a materially
different conclusion from "add an `equals`".

**Finding 10 — agree, low severity, correctly explained.** `ddl-auto:
validate` compares type names and not lengths, so eleven `@Column`s whose
implicit 255 disagrees with the migration's declared width pass validation
today. Real, cheap to fix, no live consequence. Worth recording mainly
because it is a case of a correct configuration (`validate`) creating a false
sense of coverage — which is the same shape as this whole project's central
theme.

**Overlap between the three agents:** the transaction-across-HTTP defect was
raised by two of three; the `RepoSyncer`-reaches-into-other-features defect by
two of three; the missing `SyncService` transaction boundary by two of three.
Overlap of roughly a third, from agents with deliberately different mandates,
with each still producing findings the others did not (structure found the
missing `finding` test package; JPA found the proxy-unsafe `equals`;
architecture found the entity in the controller). Dispatching all three is
not redundant.

---

# Synthesis

Written in Task 14, the final task. This is the deliverable the other
thirteen tasks existed to produce: the first validation of
`spring-boot-guide` v1.0.0 against real code. Until this project, every
assertion in the plugin ran against synthetic fixtures — the README says so
itself (Known limitation 8: "The plugin has never been run against a real
Spring Boot codebase… False positives on real code remain the failure mode
most likely to be hiding").

## Read this first: what this exercise can and cannot tell you

**The code was written by implementers following a plan I authored with the
rule set open in front of me.** Briefs handed implementers verbatim Java. So
the code largely pre-complies with the rules by construction, and a rule
staying silent on it is weak evidence that the rule would stay silent on code
written without the rules in view. That structurally limits false-positive
discovery — which is the failure mode the plugin's own README names as the
one most likely to be hiding, and which the spec named as this exercise's
main prize.

This was identified during Task 4 and the decision recorded was to continue
rather than change method mid-flight, so results stay comparable task to
task. A reader needs this to weigh everything below. In particular: **"31 of
39 rules could not fire because the violating pattern never occurred" is
partly a fact about the plan, not only about the codebase.**

Three counterweights did generate code the rules had not been consulted about,
and every genuine result below comes from one of them:

1. **Two deliberately planted defects.** The SB101 `@Transactional`
   self-invocation (Task 8) and the `FindingService.toDto` N+1 (Task 10).
   Both produced clean results — one caught by a hook, one missed by the hook
   and caught by an agent.
2. **Implementer deviations where reality differed from the plan.** Eight
   Boot 4.1 API relocations the plan got wrong (`@DataJpaTest`, `@WebMvcTest`,
   the `spring-boot-restclient` module, the starter split, `@Primary` in a
   slice test, and others). Each forced unplanned code.
3. **Emergent structure nobody designed.** The three false positives all
   landed on field names the plan never chose deliberately, and the SB110
   miss below is on a controller shape that accumulated across two tasks.

The one class of result this method is *good* at, and which is not
compromised: **rules that should have fired and did not.** A miss does not
care whether the code was pre-complied — the defect was there, the rule ran,
and it said nothing. That is also precisely what the plugin's mutation gate
structurally cannot produce, because a mutation test asks "does disabling
this detector break its own fixture?" and a fixture is by definition a case
the author already thought of.

## Tally

Counting **firings** (hook output events), across Tasks 2-13:

| Verdict | Count |
|---|---|
| True positive | 4 |
| False positive | 3 |
| Noise | 0 |
| Should have fired, did not | 2 rules (SB110, SB111) + 1 structural surface gap |

**True positives (4):** SB001 (Task 2, deliberate probe — field `@Autowired`
blocked), BG002 (Task 2, deliberate probe — bare `mvn -version` blocked),
SB101 (Task 8, the planted self-invocation — and all four tests passed *with
the defect live*, so the bug was silent and only the advisory caught it),
SB113 (Task 8, the 8-parameter `SyncService` constructor).

**False positives (3):** SB106, three times — Task 8 (`github` field in
package `…github`), Task 9 (`catalog` in `…catalog`), Task 10 (`activity` in
`…activity`). One root cause, traced to source, with **two negative controls**
confirming the mechanism (fields `plugins`/`rules` in `…catalog` and
`findings` in `…finding` did **not** fire, because the field name does not
exactly equal the package's last segment). The third occurrence was
**predicted in advance** in the Task 10 dispatch and landed as predicted.

**Noise (0), stated as a result rather than left blank.** Nothing fired that
was technically correct but not worth the interruption. Every firing was
either a genuine catch or a genuine defect in the rule. That is a good
property and worth naming: this rule set does not chatter. (Two *agent*
findings were noise — architecture #6 and jpa #5, the same in-JVM filtering
observation — but no hook produced any.)

**Should have fired and did not (2 rules + 1 structural):**

- **SB111** — the planted double N+1 in `FindingService.toDto`, live in a
  linted file. Missed for two independent reasons (no `for` loop in the file;
  the walk is a to-one proxy chain, not a collection walk). Pre-admitted by
  the README as best-effort, but a miss is a miss.
- **SB110** — `SyncRun`, an `@Entity`, crosses into `SyncController` as a
  method parameter type. Missed for two independent reasons, of which only
  the first is documented (feature-first packaging defeats the `.entity.`
  heuristic; **same-package entities produce no import line at all**, which
  defeats the rule regardless of naming convention).
- **Structural: the `Bash` write bypass.** Not a per-rule miss — every one of
  the 33 `Write|Edit`-scoped rules was silently inert for three whole tasks.
  15 files from Tasks 2-4 were never linted; re-verification found nothing
  actually violating, so no rule is retroactively reclassified, but the
  *surface* had a hole an ordinary tool-use path walks straight through.

The ratio to notice is not 4:3. It is that **both** of the deliberately
planted defects tested a different thing and gave different answers (SB101
caught, SB111 missed), and that all three false positives are one bug.

## Prioritised fix list for `spring-boot-guide` v1.1

| Priority | Rule | Change | Evidence |
|---|---|---|---|
| **P0** | Hook surface (`hooks.json`, both plugins) | Add a `PostToolUse` hook matched on `Bash` that lints whatever files the command wrote. A `PreToolUse` hook cannot do this — it runs before the command and cannot know what an arbitrary shell command will write. Until it exists, document that `Write`/`Edit` is **required**, not preferred, for any file a rule can apply to. | "STRUCTURAL — Bash writes bypass every Write\|Edit-scoped hook". 33 of 39 rules inert for Tasks 2-4; 15 files never linted. Reachable by default: this harness's own auto-mode guidance instructs agents to prefer Bash heredocs over `Write`. |
| **P0** | SB106 | Exclude lines beginning `package` / `import` from the declaration scan at `hook-lint.sh:867`, or require a type token before the field name. The regex `^[^\n;]*\b(NAME)\s*(?:;\|=)` matches `package com.x.github;` when the field is named `github`; `break` then stops before the real declaration. | 3 firings, all false, Tasks 8/9/10, traced to source by running the embedded Python directly; 2 negative controls. **Sharpest point: this collides hardest under feature-first packaging, which the plugin's own `project-structure` skill mandates.** A field named `config` in `…config`, or `github` in `…github`, is the naming that skill pushes you toward. |
| **P0** | SB110 | Detect "a type declared with `@Entity`" semantically instead of "a type imported from a package named `entity`/`domain.model`". This fixes both defects at once — the package heuristic *and* the same-package case where no import line exists for the regex to find. | Task 14 SB110 entry: `SyncRun` (`@Entity`) is a parameter type of `SyncController.toDto`. Found by `spring-architecture-review`; no hook saw it. Defect 2 (same-package) is **undocumented** — README limitation 4 describes only the naming heuristic. |
| **P1** | SB007 / SB012 / SB013 | Widen the **script-level basename gate** at `hook-lint.sh:126-134`, which `exit 0`s the entire hook process for any `.properties`/`.yml`/`.yaml` file whose basename does not start with `application`. Dropping the basename requirement in favour of the existing path-based `is_main_config()` is the cleaner fix. Adding directories to `is_main_config` does **not** help — that gate is never reached. | Task 13 entry (corrected). The blind spot is naming-based, not location-based: `src/main/resources/db-secrets.yml` containing `password: hunter2` gets **zero** coverage from all three config rules, despite sitting in Spring's own config root. |
| **P1** | SB111 | Either widen to stream pipelines and to-one proxy chains, or — better, given the false-positive cost the rule's own comment cites — leave the detector alone and change the *message* to say what it cannot see and to name `jpa-review` as the required backstop. The rule currently reads as N+1 coverage while providing a narrow slice of it. | Task 10: planted double N+1 missed; `jpa-review` caught it on the identical unmodified code and characterised it *more* precisely (double N+1, unbounded endpoint) than SB111's message would have. Reviewer independently read `check_sb111` (`hook-lint.sh:1020-1042`) and confirmed the miss is structural, not incidental. |
| **P1** | Docs / packaging | Ship the three review agents as a required part of the workflow rather than an adjunct, and say in the README that hooks alone leave the cross-file N+1 and entity-boundary cases uncovered. | Both should-have-fired misses were caught by agents (SB111→`jpa-review`, SB110→`spring-architecture-review`). Two independent measured instances, on real code, with the defect live. |
| **P2** | README limitation 8 | Retire it — the plugin has now been run against a real Spring Boot codebase. Replace it with what this run actually found, including the methodology caveat above, so the next reader does not overread a low false-positive count. | This document. |
| **P2** | README limitation 4 | Extend it: SB110 is defeated not only by a project that avoids `.entity.` packages, but by any controller sitting in the *same package* as the entity it leaks, whatever the naming convention. | Task 14 SB110 entry, defect 2. |
| **P3** | SB113 | No change to the threshold. Worth a note in the skill: resolving SB101 by splitting a bean tends to leave the new bean near the parameter limit (`RepoSyncer` landed at 6 of 7), so the two rules interact. | Task 8: the SB101 split fixed SB113 as a side effect; Task 8's deferred minor records `RepoSyncer` one dependency short of retripping it. |
| **—** | SB005 / SB009 / literal stripping | **No change — keep exactly as built, and hold it up as the reference implementation.** `CODE_PATH` blanks string-literal content by default and a rule opts into `LITERAL_PATH` when it genuinely needs to see inside the quotes (only SB105 does). | Task 14 entry: `"FetchType.EAGER"` and `"@RequestMapping(method = …)"` sit as literal strings in two linted test files and neither rule fired. The sibling `angular-guide` plugin, same workspace, produced **three** NG001 false positives on exactly this shape because it does not strip literals. Same hazard, two architectures, measurably different outcomes. |
| **—** | SB019 / SB020 / SB103 / SB102 | **No change.** All four ran with their gates satisfied, against code that genuinely contained their trigger surface, and all four correctly stayed silent. | SB019 silent on 4 × `@MockitoBean` (verified present unrelocated in `spring-test-7.0.8.jar`); SB020 silent on 7 × `com.fasterxml.jackson.annotation.*` imports with `jackson_major: 3` (the exemption held); SB103 silent across 5 `RestClient` call sites with `boot_major: 4`; SB102 silent on `open-in-view: false` with `data-jpa` in starters. These four are the Boot 4 decision's whole point, and they behaved. |

## Coverage audit — all 39 rules, one bucket each

Buckets: **fired**, **could not fire here** (the violating pattern never
occurred, or gating disabled it — stated per rule), **should have fired and
did not**.

### Fired — 5 rules

| Rule | Where | Verdict |
|---|---|---|
| BG002 | Task 2, `mvn -version` with `wrapper: true` | True positive (deliberate probe) |
| SB001 | Task 2, `@Autowired private String value;` in `Probe.java` | True positive (deliberate probe) |
| SB101 | Task 8, `SyncService.syncAll()` → `this.syncRepo(...)` | True positive (planted defect) |
| SB106 | Tasks 8, 9, 10 — three firings | **False positive ×3** |
| SB113 | Task 8, 8-parameter `SyncService` constructor | True positive |

### Should have fired and did not — 2 rules

| Rule | The defect that was present | Why it was silent |
|---|---|---|
| SB110 | `SyncRun` (`@Entity`) as a parameter type of `SyncController.toDto`, with the entity handed out of the service layer | (a) package `…github` matches neither `.entity.` nor `.domain.model.`; (b) **same package as the controller, so no `import` line exists** and the rule's candidate-name set is empty before any usage check runs |
| SB111 | The planted double N+1 in `FindingService.toDto` (`Finding→Rule→Plugin`, up to 2N+1 queries on an unbounded endpoint) | (a) no `for` statement in the file — a `.stream().map(methodRef)` pipeline; (b) the terminal call is a scalar getter on a to-one proxy, not a collection walk. Doubly outside the regex, and arguably outside the rule's intended target |

Plus one **structural** gap that is not a per-rule miss: the `Bash` write
bypass left all 33 `Write|Edit`-scoped rules inert across Tasks 2-4 (15 files
never linted).

### Could not fire here — 32 rules

**Disabled by gating (1):**

| Rule | Gate | Why |
|---|---|---|
| SB006 | `lombok: false` in the workspace profile | The rule is gated off entirely, regardless of what the entity code contains. Task 4 wrote hand-rolled `equals`/`hashCode` and plain accessors; adding Lombok purely to provoke the rule would mean shipping code nobody would write. **This belongs here and not in "should have fired" — miscategorising a disabled gate as a plugin gap would fabricate a defect the plugin does not have.** |

**The violating pattern never occurred (31):**

| Rule | What was present instead | Ran with trigger surface genuinely nearby? |
|---|---|---|
| BG001 | No force push was ever attempted | No |
| BG003 | Maven throughout; Gradle never invoked | No |
| BG004 | No `spring-boot:run`/`bootRun`/`--continuous`/`-t` was ever run | No — **and note why: the controller forbade starting the app by policy, which is exactly what BG004 exists to enforce. The rule's protection was never actually tested here.** |
| BG005 | No `rm -r` near a wrapper or lockfile | No |
| BG006 | No `-Dspring.jpa.hibernate.ddl-auto=` on any command line | No |
| SB002 | `@Autowired` never preceded a constructor | No |
| SB003 | 4 `@Transactional`, all on public types/methods | Yes — `RepoSyncer.sync` is `public` |
| SB004 | No `@Transactional` in any controller file; boundaries on the services | Yes — 4 `@RestController`s coexist with 4 `@Transactional` services |
| SB005 | All 5 associations explicitly `FetchType.LAZY` | Yes — and a literal `"FetchType.EAGER"` string in a linted test file correctly did **not** fire |
| SB007 | `ddl-auto: validate` | Yes — rule ran on `application.yml` and passed |
| SB008 | No `@Query` anywhere; all derived query methods | No |
| SB009 | 4 class-level `@RequestMapping`, path only, no `method =` | Yes — and a literal `"@RequestMapping(method = …)"` string in a linted test file correctly did **not** fire |
| SB010 | No Spring Security on the classpath at all | No |
| SB011 | No `SecurityFilterChain` anywhere | No |
| SB012 | `github.token: ${GITHUB_TOKEN:}`, `password: ${DB_PASSWORD:showcase}` — both `${…}` references, never literals | Yes — rule ran on `application.yml` and `application-local.yml` and correctly passed both. See the bucket correction above: the `compose.yaml` scope gap is a *latent* gap, not an observed miss |
| SB013 | `management.endpoints.web.exposure.include: health,info` | Yes |
| SB014 | Every import is `jakarta.*`; zero `javax.` | No |
| SB015 | No `System.out`/`System.err`/`printStackTrace` in main sources | No |
| SB016 | 4 `catch` blocks, every one with a body | Yes |
| SB017 | No `Thread.sleep` in test sources | No |
| SB018 | JUnit 5 throughout; zero `org.junit.` non-jupiter imports, zero `@RunWith` | No |
| SB019 | 4 × `@MockitoBean`; zero `@MockBean`/`@SpyBean` | Yes — severity gate satisfied (`boot_major: 4`), rule ran, correctly silent. One of the two rules the Boot 4 decision existed to exercise |
| SB020 | 7 imports, all `com.fasterxml.jackson.annotation.*` — the exemption | Yes — firing gate satisfied (`jackson_major: 3`), rule ran, exemption held. The other Boot 4 exercise rule |
| SB102 | `spring.jpa.open-in-view: false` | Yes — gate satisfied (`data-jpa` in starters) |
| SB103 | `RestClient` at 5 call sites; the only `RestTemplate` token is a javadoc mention (comments are blanked before matching) | Yes — gate satisfied (`boot_major: 4`) |
| SB104 | No `.csrf(` anywhere | No |
| SB105 | `allowedOrigins("http://localhost:4200")` — enumerated, not `*` | Yes |
| SB107 | Zero `@Value` in the codebase; config binds through a `@ConfigurationProperties` record | No |
| SB108 | No `new ObjectMapper(`/`new JsonMapper(` | No |
| SB109 | All 4 `*ControllerTest` files use `@WebMvcTest`; the 2 `@SpringBootTest` files are `ShowcaseApplicationTests` and `SyncServiceTest`, neither matching the name pattern | Yes |
| SB112 | All 5 `@ManyToOne` carry an explicit `fetch =` | Yes — 7 entity files, evaluated per occurrence |

**Bucket totals: 5 fired, 32 could not fire here (1 by gating, 31 because the
pattern never occurred), 2 should have fired and did not. 5 + 32 + 2 = 39.**

Read that middle column honestly. **14 of the 32 had their trigger surface
genuinely present** — a real `@ManyToOne`, a real `@RestController`, a real
`catch`, a real config key — and the rule ran and correctly said nothing.
That is meaningful negative evidence. The other 18 had no occasion to run at
all (no Spring Security, no Lombok, no `@Query`, no Gradle, no JUnit 4), and
their silence says nothing about them either way. Distinguishing these two is
the difference between "this rule works" and "this rule is untested".

## Verdicts on the design's open questions

### Plugin coexistence

**They coexisted cleanly at the lint layer and collided at two other layers —
one cosmetic, one real.**

**Profiles: coexisted, no conflict.** Both `SessionStart` detectors ran and
both wrote their own dotfile at the same repo root, side by side and
mutually invisible: `.angular-guide-project.json` and
`.spring-boot-guide-project.json` (a third, `.ios-from-web-guide-project.json`,
is also present from an unrelated installed plugin, correctly reporting
`is_ios_project: false`). Neither detector read or overwrote the other's file.
`spring-boot-guide`'s `detect_project.sh` walked up to two levels to find the
nested `backend/pom.xml` in this monorepo and resolved
`project_root: …/backend` while `workspace_root` stayed at the repo root —
which is exactly the monorepo case its README documents, and it worked on the
first try.

**File-type routing: no cross-firing, by construction.** Both `hook-lint.sh`
scripts gate on extension within ten lines of reading the file path:
`angular-guide` does `case "$EXT" in ts|html) ;; *) exit 0 ;;` and
`spring-boot-guide` does `case "$EXT" in java|properties|yml|yaml) ;; *) exit 0 ;;`.
The sets are disjoint. Over the whole project: **no NG rule ever fired on a
`.java`, `.yml` or `.sql` file, and no SB rule ever fired on a `.ts` or
`.html` file.** Both also resolve their profile by walking up **from the
edited file** rather than from `$PWD`, so editing a backend file from a
frontend cwd (and vice versa) resolves correctly. This is the clean result.

**Bash guards: the one real collision.** Neither plugin's `bash-guard.sh`
gates on file type — there is no file to gate on — and `angular-guide`'s
BG004/BG005 have no profile gate either, so **both guards inspect every Bash
command in the repository, whatever you are working on.** That is how
`angular-guide`'s BG004 came to block a command issued while working on the
Spring backend (Task 11's ledger append, from the repo root). The guards do
not conflict with each other — they just both always run — but the effect is
that an Angular rule can block Java work and vice versa. Fixable by gating a
Bash guard on the workspace the command is actually running in, though that
is genuinely hard for an arbitrary shell command.

**ID namespace collision: cosmetic but confusing.** Both plugins number their
Bash guards `BG001`-`BG006`, and the meanings are entirely different —
`spring-boot-guide`'s BG002 is "bare `mvn` when a wrapper exists" while
`angular-guide`'s BG002 is "`ng build --prod`, removed in Angular 12";
`spring-boot-guide`'s BG004 is "`spring-boot:run` will hang the session"
while `angular-guide`'s BG004 is "`ng test` will hang the session". Both emit
output prefixed with the bare ID. **A reader of a transcript, or of these
logs, cannot tell which plugin spoke without reading the message body.** This
caused a real attribution problem while writing this synthesis. Recommend
prefixing the ID with the plugin (`SBG-BG004` / `NG-BG004`) or namespacing it
in the output line.

**Verdict: coexistence is safe. Run them together.** The one behaviour to be
aware of is that Bash guards are workspace-blind; the one thing to fix is the
shared ID namespace.

### Detection after the restructure

`angular.json` moved from the repo root to `frontend/` in Task 1, and
`backend/` was created as a sibling with its own `pom.xml`. Both plugins'
detection survived, for different reasons:

- `angular-guide`: survived by coincidence rather than design. `find_profile()`
  never reads the `workspace_root` field it writes and never looks for
  `angular.json` at lint time — it walks up from the edited file looking only
  for the profile dotfile, which happens to sit on an ancestor path of
  everything. The `workspace_root` value is now stale and inert.
- `spring-boot-guide`: survived by design. `detect_project.sh` explicitly
  walks up to two directory levels to find a nested manifest — the monorepo
  case is a documented feature, and `backend/pom.xml` was found correctly with
  `project_root` and `workspace_root` recorded as different paths.

**Verdict: detection is robust to this restructure in both plugins, but only
one of them is robust on purpose.**

### Agent value — did the three review agents find what the hooks could not?

**Yes, decisively, with two measured instances on real code with the defect
live — and with one important caveat that cuts the other way.**

The two instances:

1. **Task 10, SB111 vs. `jpa-review`, same unmodified code.** SB111 was
   silent on the planted double N+1. `jpa-review`, dispatched against the
   identical tree before any fix, caught it, identified it as a *double* N+1
   spanning `Finding.java` / `Rule.java` / `FindingService.java`, located the
   unbounded `GET /api/findings` endpoint as the reason it mattered, and
   recommended the exact `@EntityGraph` that fixed it. Verified by a reviewer
   against pre-fix line numbers, so the transcript was captured against the
   real defective state.
2. **Task 14, SB110 vs. `spring-architecture-review`.** SB110 was silent on
   an `@Entity` crossing into a `@RestController`. The architecture agent
   found it, and named the rule's own blind spot unprompted: "the package is
   `github`, not `entity`, which is exactly the case the per-file SB110
   heuristic cannot see."

Beyond those two, this run's agents produced findings no regex rule in the set
could express: the `RepoSyncer`-reaches-into-two-other-features boundary
violation with its triplicated business-key derivation (raised independently
by two of three agents); `SyncService` having no transaction boundary at all;
the missing `finding` test package; and — the best single finding of the
Task 14 round — every entity's `equals` reading `that.field` directly instead
of `that.getField()`, which silently returns false against an uninitialized
lazy proxy, in a codebase where **every** `@ManyToOne` is `LAZY`.

**The caveat, which matters as much as the result.** That `equals` defect was
in `Plugin`/`Rule`/`Skill` from Task 4, and Task 4's own `jpa-review` run
looked at those exact files and reported the equality implementations as
"well-formed" — and I recorded a true-negative verdict agreeing with it. Two
independent readers, agent and human, ratified a real defect as clean, and it
took a third look eight tasks later to catch it. **An agent's clean report is
not a proof, and agents are not deterministic checkers.** The correct
conclusion is not "agents dominate hooks"; it is that hooks give you a fast,
deterministic, always-on floor with known blind spots, and agents give you
cross-file reasoning with non-deterministic recall. Each covers the other's
failure mode, and neither covers its own. **Ship both, and do not let a clean
agent report retire a rule.**

## Assessment against the spec's five success criteria

| # | Criterion | Status |
|---|---|---|
| 1 | The backend builds and runs locally; all three front-end routes render against it. | **Partially met — see below. Do not read this as fully verified.** |
| 2 | Every hook firing during the build is recorded and triaged. | **Met** — 7 firings, each with rule id, verbatim hook output, the exact code, a verdict and an action |
| 3 | A concrete prioritised fix list for v1.1, or a plain statement that none is warranted | **Met** — 11 rows above, 3 at P0, each with per-row evidence |
| 4 | A verdict on plugin coexistence, and on whether `angular-guide`'s detection survived the restructure | **Met** — see "Plugin coexistence" and "Detection after the restructure" |
| 5 | All three review agents dispatched at least once against real code, output triaged like a hook firing | **Met** — all three run in Task 14 against the finished backend (plus earlier runs in Tasks 4, 9 and 10); 22 findings triaged individually, including the two I judge noise |

**Criterion 1, stated honestly.** What was actually verified, and how:

- *The backend builds:* yes, by `./mvnw verify` — full build including Testcontainers
  integration tests against a real `postgres:16-alpine`. **36 tests across 10 test classes, 0
  failures, 0 errors, 0 skipped.**
- *The front end builds and its tests pass:* yes — `npm test -- --watch=false` gives **52 tests
  across 8 files, all passing**, and `npm run build` produces a clean production bundle (297 kB
  initial, with `skills-page`, `rules-page`, `activity-page` and `contributor-card` each still
  in their own lazy chunk).
- *The backend runs locally, and all three routes render against it:* **not verified by hand.**
  This was my constraint, not an oversight: agents were forbidden from starting the application
  (`./mvnw spring-boot:run` never exits — it is what `spring-boot-guide`'s own BG004 exists to
  block — and running the app is the user's job, not an agent's). Task 12's Step 6, which
  specified a manual end-to-end check against a live backend and then against a stopped one to
  exercise the degraded and failed states, was therefore **never performed**.

So the front end's wiring to the backend is verified by **unit and component tests plus a
production build**, not by a human loading the pages. Specifically unverified end to end: that
a running backend actually serves the five endpoints the front end calls with the field names
the DTOs declare (the DTO-to-TypeScript field mapping *was* verified statically, record by
record, during Task 11's review — but statically); that the stale-notice renders on a real
degraded response; and that the error-state renders against a genuinely stopped backend. A
reader should treat criterion 1 as "builds green, integration-tested at the repository layer,
not smoke-tested through the UI."

This does not affect any finding in this document — every plugin result above comes from hook
output, rule source, or agent analysis, none of which depends on the application having been
run.

## Was the plugin worth having?

Yes, and more clearly than the sibling `angular-guide` log could claim for its
own plugin — but the honest reason is narrower than the headline numbers
suggest.

**The case for.** Every rule that ran behaved as documented. The one planted
defect a hook could see, a hook caught (SB101) — and caught it in the only
circumstance where a static rule genuinely earns its keep: all four tests
passed with the bug live, so nothing else in the project would have found it.
The two Boot 4 rules the whole technology choice was made to exercise (SB019
on `@MockitoBean`, SB020 on the Jackson annotation exemption) both held their
exemptions against real trigger surface. The literal-stripping architecture
prevented an entire class of false positive that the sibling plugin hit three
times in the same workspace. And 14 rules ran against genuinely present
trigger surface and correctly said nothing, which is what a blocking rule set
is supposed to do most of the time.

**The case against, plainly.** Three of seven firings were false, all from one
uncorrected bug, and that bug is not random: **SB106 misfires hardest on the
naming that the plugin's own `project-structure` skill tells you to adopt.**
Follow the plugin's structural advice and you get false blocks. That same
collision appears a second time in SB110, which is keyed to a layered
`.entity.` package layout that the same skill steers you away from — so
following the plugin's advice also turns one of its rules off. **Two of the
three most serious findings in this document are the plugin disagreeing with
itself**, and neither would ever surface in a fixture suite, because fixtures
are written rule-by-rule and this is an interaction between a rule and a
skill.

**What the mutation gate could not have told them.** The gate proves every
detector is load-bearing for its own fixture. It cannot produce a single row
of the "should have fired and did not" table, cannot detect that a rule's
implementation contradicts a skill's advice, and cannot notice that the entire
enforcement surface has a hole where `Bash` writes files. All three of this
project's most valuable findings are of exactly those kinds. That is the
argument for running a plugin against real code, and it is the thing this
exercise was built to demonstrate.
