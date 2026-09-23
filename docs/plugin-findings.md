# angular-guide — findings from real-code use

Validating `angular-guide` @ `c46a00a` while building this app.
One entry per hook firing. Verdicts: **true positive** (rule was right),
**false positive** (rule was wrong), **noise** (rule was technically right
but not worth the interruption).

Also recorded: rules that should have fired and did not.

---

## Hook firings

### NG007 — src/app/tmp-probe/probe.ts (deliberate probe, Task 1)
**Code:** `export function probe(value: any)`
**Verdict:** true positive
**Why:** deliberate probe to confirm the hooks are live before starting. Blocked as expected — but only once
`.angular-guide-project.json` existed. Before that, `hook-lint.sh` exits silently at line 160
(`[ -n "${PROFILE:-}" ] && [ -f "$PROFILE" ] || exit 0`), so the very same probe would **not** have been
blocked with no profile on disk. See the next entry.
**Action:** none — file removed.

### BG004 — `npx ng test --help` (controller verification, after Task 1)
**Code:** `npx ng test --help`
**Verbatim hook output:**
```
🚫 BG004: `ng test` runs in watch mode by default and will hang this session.
   💡 Fix: Run `ng test --watch=false` (Karma) or `ng test --run` (Vitest).
```
**Verdict:** false positive
**Why:** `ng test --help` does not run tests at all — it prints the builder's option
list and exits immediately. It cannot hang a session, which is the entire hazard BG004
exists to prevent. The guard matches on the `ng test` command prefix without excluding
the help/version forms, so any attempt to *inspect* the test command is blocked as
though it were an attempt to *run* it. This is mildly self-defeating: the natural way to
discover the correct no-watch flag is to ask the CLI for its options, and BG004 blocks
exactly that.
**Action:** none required — the command was never actually needed to proceed. Recorded as
a finding; suggested fix is to narrow BG004 to skip commands carrying `--help`, `-h`, or
`--version`.

### BG004 — `git commit` blocked on a commit-message mention of `ng test --run` (final fix wave)
**Code:** `git commit -m "$(cat <<'EOF' ... EOF)"`, where the heredoc body is this fix wave's
commit message, containing the prose sentence `moved the non-firing "npx ng test --run" entry
out of the hook-firing tally` — a description of the Blocker-1 fix, not a shell invocation of
any kind.
**Verbatim hook output:**
```
🚫 BG004: `ng test` runs in watch mode by default and will hang this session.
   💡 Fix: Run `ng test --watch=false` (Karma) or `ng test --run` (Vitest).
```
**Verdict:** false positive
**Why:** `git commit` does not run `ng test` at all — the entire command is a commit with a
literal string payload, never executed as a nested command. BG004's own guard
(`bash-guard.sh:136-137`) scans the raw `$CMD` text for the bare substring `ng test`
with no awareness of shell quoting, heredoc bodies, or that a commit message is inert prose,
not a command to run. It found `ng test` (line 16 of the message: `"npx ng test --run" entry`)
and then checked whether the whole command string also contained one of the exemption
patterns — but the exemption regex requires `--run` to be followed by whitespace, `=`, or
end-of-line (`--run([[:space:]=]|$)`), and in the message text `--run` was immediately
followed by a closing double-quote (`"npx ng test --run" entry`), not whitespace. The
exemption text was present but in a shape the exemption's own trailing-context requirement
rejected, so the base trigger fired unopposed. This is the same class of defect as the NG001
addendum documented above (a bare-text scan with no string/quoting/heredoc awareness), now
observed on BG004 instead of a `check_ng*` rule, and on a `git commit` command instead of an
`ng test` invocation — the false positive is not confined to actual test-runner commands at
all; any command whose argument text happens to contain the substring `ng test` unaccompanied
by a trailing-whitespace-anchored exemption flag can trigger it, including a commit message
describing this very defect.
**Action:** reworded the commit message to avoid the literal adjacency (referred to "the
`--run` flag" and "BG004's `--run` exemption" instead of the bare phrase `ng test --run`
inside quotes). Did not disable the plugin or bypass the hook.

### NG001 — src/app/core/parsing/rules.spec.ts (Task 3, writing the fixture README)
**Code:** the test fixture's `README` template literal contained the line
`` | NG001 | \`standalone: true\` in a decorator | Delete the property. | v20+ | `` — verbatim text from the
task-3 brief, describing NG001 as a row inside a fake markdown README used as test data.
**Verdict:** false positive
**Why:** `check_ng001()` in `hook-lint.sh` (line 323) is `grep -qE 'standalone:[[:space:]]*true' "$CODE_PATH"` —
a plain text scan of the whole `.ts` file, with no awareness of string/template-literal context. It cannot
distinguish an actual `@Component({ standalone: true })` decorator from the substring `standalone: true`
appearing inside a markdown fixture string that is *data describing* the rule, not an instance of the
violation. The file under edit is a spec file whose entire purpose is to hold example rule-table rows as text.
**Action:** reworded the fixture row to `` \`standalone\` property set to \`true\` in a decorator `` — same
test intent (an example blocking-rule row), no assertion in the spec depends on the exact wording of NG001's
trigger text, so nothing was lost. Did not disable the plugin or bypass the hook.

### NG103 — src/app/core/github/github-api.ts (Task 4, writing `GithubApi`)
**Code:** `@Injectable({ providedIn: 'root' })` on `export class GithubApi` — as specified verbatim in the
task-4 brief's Interfaces section (`GithubApi service, providedIn: 'root'`).
**Verdict:** true positive, advisory (non-blocking)
**Why:** this is a `PostToolUse` advisory, not a block — the `Write` succeeded and compilation was unaffected.
`hook-lint.sh` correctly identifies that Angular v22.1.6 exports a `Service` decorator (confirmed in
`node_modules/@angular/core/types/core.d.ts:1268-1322`: `ServiceDecorator`, called with no arguments, is
`autoProvided: true` by default — the same root-provided-singleton semantics as
`@Injectable({ providedIn: 'root' })`, just without a nested options object). The brief's Interfaces section
specifies the *behavior* ("providedIn: 'root'"), not literal decorator syntax, so switching to `@Service()`
satisfies the brief's contract and the plugin's modern-Angular guidance at once.
**Action:** complied — changed `GithubApi` to `@Service()` and dropped the `Injectable` import. Behavior is
identical (root-provided singleton); this is a syntax modernization, not a functional change.

### NG001 — src/app/features/rules/rules-page.spec.ts (Task 7, writing the fixture README, second occurrence)
**Code:** the test fixture's `README` template literal contained the line
`` | NG001 | \`standalone: true\` | Delete it. | v20+ | `` — copied verbatim from the task-7 brief's spec, the
same shape as Task 3's fixture row: an example rule-table row used as test data, describing NG001's own
trigger text.
**Verdict:** false positive
**Why:** identical root cause to the Task 3 entry above — `check_ng001()` in `hook-lint.sh` is a plain
`grep -qE 'standalone:[[:space:]]*true'` over the whole `.ts` file with no string/template-literal awareness.
It cannot tell a real `@Component({ standalone: true })` from the substring `standalone: true` sitting inside
a markdown README fixture that exists to *describe* the rule as sample data. This is the exact same false
positive recurring in a second file, on a second task, from a second brief's verbatim spec text — which is
itself a finding: any spec fixture that quotes NG001's own trigger text as an example row will reproduce this
block, and the pattern is now confirmed, not a one-off.
**Action:** reworded the fixture row to `` \`standalone\` property set to \`true\` in a decorator ``, matching
the wording Task 3 already settled on for the same problem. No test in this spec asserts on the exact wording
of NG001's trigger text (the assertions check `toHaveLength`/`toContain('NG001')`/`toContain('four-column')`),
so nothing was lost. Did not disable the plugin or bypass the hook.

### NG001 — src/app/core/parsing/rules.spec.ts (final fix wave, blocker-5 test, third occurrence)
**Code:** the new 5-column-table regression test's fixture string contained
`` `standalone: true` in a decorator `` — copied from the blocker report's own reproduction example, describing
a hypothetical upstream README row as test data, not a real decorator.
**Verdict:** false positive
**Why:** identical root cause to the Task 3 and Task 7 entries above — `check_ng001()` is a bare
`grep -qE 'standalone:[[:space:]]*true'` over the whole file with no string/template-literal awareness, so it
cannot distinguish this substring appearing inside a test-fixture string from an actual
`@Component({ standalone: true })`. Third occurrence of the exact same false positive, in a third file, across
three separate work sessions — the systemic pattern documented in the "NG001 addendum" entry below reproduced
itself immediately upon writing a new fixture, exactly as that entry predicted it would for "any spec fixture
that quotes NG001's own trigger text as an example row."
**Action:** reworded the fixture row to `` \`standalone\` property set to \`true\` in a decorator ``, the same
wording Task 3 and Task 7 already settled on, preserving the same test intent — a 5-column row whose first
cell is a rule ID. No assertion in the test depends on the exact wording. Did not disable the plugin or bypass
the hook.

### NG001 addendum — the plugin has a spec-file escape hatch and 20 of 24 rules ignore it
**Extends:** the Task 3 NG001 false-positive entry above (recurring a second time in the Task 7
entry below it).
**Verdict:** true defect (systemic, not specific to NG001)
**Evidence:** `hook-lint.sh:175` defines the helper
`is_spec() { printf '%s' "$FILE_PATH" | grep -qE '\.spec\.ts$|\.test\.ts$'; }`
Its existence is an explicit acknowledgement that `.spec.ts` files legitimately contain code-shaped
text as *data* — fixtures, example rows, illustrative snippets — which must not be judged as
production code. But only four rules call it:
- NG010 (`hook-lint.sh:480`)
- NG102 (`:735`)
- NG105 (`:779`)
- NG106 (`:793`)
The remaining twenty `check_ng*` functions, NG001 included, scan spec files exactly as they scan
production code. NG001's implementation (`:320-328`) is a bare
`grep -qE 'standalone:[[:space:]]*true'` over the comment-stripped file, with no awareness of string
or template-literal context — so any spec holding the substring `standalone: true` as test data is
blocked, which is exactly what happened when Task 3 (and again Task 7) wrote a markdown fixture
describing NG001 itself.
**Why this matters:** the false positive is not a one-off of NG001's regex. It is the default
behaviour of 20 rules, and it will recur for any project whose tests contain example Angular code —
which is most of them, and *especially* any project testing Angular tooling. The irony is sharp here:
the rule fired on a fixture whose content is the rule's own documentation, twice in the same project.
**Suggested fix (ordered by effort):**
1. Audit all 24 `check_ng*` functions and add `is_spec && return 0` wherever a rule targets a
   production-code pattern that a fixture could legitimately contain as text. NG001-NG006 and
   NG011-NG013 look like immediate candidates.
2. Better, for the text-scanning rules specifically: strip string and template literals before
   matching, the way comments are already stripped (`hook-lint.sh` builds a comment-free `CODE_PATH`
   — the same treatment for string contents would fix this class at the root rather than per-rule).
3. At minimum, downgrade to advisory inside spec files rather than blocking, so a fixture cannot
   halt work.

### Detection after monorepo restructure (Task 1, Spring backend plan)
**Change:** `angular.json` moved from the repo root to `frontend/`.
**Verdict:** true positive (detection survived; not the risk the plan anticipated)
**Why:** the plan's brief flagged a real risk on paper — `.angular-guide-project.json` is
gitignored and its `workspace_root` field pins the repo root, while `angular.json` is no longer
there, so the two facts looked like they should desync detection. They don't, because
`hook-lint.sh`'s `find_profile()` (line ~132) never reads `workspace_root` or looks for
`angular.json` at all: it walks up the directory tree **from the edited file** looking only for
the presence of a `.angular-guide-project.json` file. Confirmed by reading the function directly
and by grepping the whole plugin tree for `workspace_root` — the only reader of that field is
`detect_project.sh`, which writes it; nothing consumes it at lint time. Since `frontend/` is a
subdirectory of the repo root, walking up from
`frontend/src/app/tmp-probe/probe.ts` reaches the same `.angular-guide-project.json` the plugin
wrote before the move. The `any`-typed probe (`export function probe(value: any) { return
value; }`) was blocked by NG007 on the first write attempt — no re-detection or session
restart was needed, and the probe file was never created on disk (the hook blocks before the
write lands). The `workspace_root` value inside the profile is now stale (still points at the
repo root, not `frontend/`) but is inert — nothing reads it — so the staleness has no
behavioral effect today. This is a coincidence of the profile file's own location (root,
gitignored, untouched by `git mv`) landing on an ancestor path of every file the workspace still
edits, not a property of the `workspace_root` field being correct.
**Action:** none required for detection to keep working. Worth flagging upstream: `angular_major`,
`test_runner`, and the other gate-relevant fields in the profile were captured from an
`angular.json` that has since moved and could drift from reality after further restructuring
(e.g. a second Angular project added under a different subdirectory, or the workspace renamed) —
a future `detect_project.sh` re-run would be needed to refresh them. Recommend re-running
`detect_project.sh` after structural moves even though nothing failed here, since the *content*
of the profile (not just its resolvability) is what the version-gated rules trust.

### BG004 — `npx ng test --help` (Task 11, front end rewired to the showcase backend)
**Code:** `npx ng test --help`, run to check the `@angular/build:unit-test` builder's flag
names before choosing how to filter a single spec file.
**Verbatim hook output:**
```
🚫 BG004: `ng test` runs in watch mode by default and will hang this session.
   💡 Fix: Run `ng test --watch=false` (Karma) or `ng test --run` (Vitest).
```
**Verdict:** false positive — same defect as the controller-verification entry recorded earlier
in this log ("BG004 — `npx ng test --help` (controller verification, after Task 1)"), reproduced
a second time, independently, in this task.
**Why:** identical root cause: `--help` prints the builder's option list and exits immediately,
it cannot hang a session, and BG004's guard matches on the `ng test` command prefix with no
exclusion for `--help`/`-h`/`--version`. This is not a new defect, just a second live occurrence
of the one already on file — recorded per this task's instruction to report every firing
explicitly, not because the underlying cause is new.
**Action:** none required — worked around by using `npm test -- --watch=false` (no positional
filter argument; passing one, e.g. `npm test -- --watch=false showcase-api`, was rejected by the
CLI's own argument parser with `Unknown argument: watch`, a separate and unrelated harness
quirk, not a plugin firing) to discover the correct flag empirically instead. Did not disable
the plugin or bypass the hook.

---

## Defects that are not hook firings

These are real BG004 defects, but neither is a firing and neither belongs in the tally above —
one was moved here on correction (see the note below), the other was never counted as a firing
in the first place. Both are the same underlying defect: BG004's advice, not its trigger, is
broken for this toolchain.

### BG004 — `--run` remedy is broken on this toolchain (not a firing)
**Where surfaced:** Task 1's verification step specified `npx ng test --run` verbatim, exactly as
written in the task-1 brief.
**Verdict:** true defect (inaccurate remediation) — **not a hook firing**
**Why this is not a firing:** the original version of this log entry lived under "Hook firings"
with a "true positive" verdict, on the claim that BG004 "correctly blocked" this command. That
was wrong, and is corrected here. BG004's guard (`bash-guard.sh:135-136`) is:
```bash
if printf '%s' "$CMD" | grep -qE '(^|[[:space:]&|;])ng[[:space:]]+test([[:space:]]|$)' \
   && ! printf '%s' "$CMD" | grep -qE -- '--watch[= ]false|--no-watch|--run([[:space:]=]|$)|--ci([[:space:]=]|$)'; then
```
The negative lookahead explicitly exempts `--run` from the block condition, so `npx ng test --run`
was *accepted* by the guard, not blocked. There is no verbatim hook output for this entry — unlike
every genuine firing above — because nothing fired. The command simply reached the Angular CLI,
which then rejected it on its own terms.
**Why it still matters:** BG004 correctly blocks bare `ng test` (which defaults to watch mode and
hangs a non-interactive session) — that part of the guard is sound. But one of the flag forms it
accepts as satisfying the rule does not work on this toolchain: Angular v22.1.7's
`@angular/build:unit-test` builder rejects `--run` outright —
```
$ npx ng test --run
Error: Unknown argument: run
```
— and BG004's own fix text ("Run `ng test --watch=false` (Karma) or `ng test --run` (Vitest)")
recommends exactly that broken flag as the Vitest-flavored alternative. The CLI wrapper validates
its own argument list before delegating and never passes `--run` through to the Vitest binary
underneath, so a user who follows BG004's own suggested fix hits a second, unrelated failure.
`--watch=false` works on both builders and is what this project used throughout.
**Action:** used `npx ng test --watch=false` for all test runs in this project (see the Task 1
report). Suggested fix: change BG004's fix text to recommend `--watch=false` unconditionally; drop
the `--run` variant or gate it on a builder check.

### BG004 — remedy text is wrong for Angular v22's Vitest builder (controller-verified, second pass)
**Related to:** the entry directly above — same underlying defect, verified independently by the
controller after Task 1.
**Verdict:** true defect (inaccurate remediation) — not a hook firing
**Why:** re-confirms the above directly against this workspace: Angular CLI 22.1.7, builder
`@angular/build:unit-test`, Vitest 4.1.11 —
```
$ npx ng test --run
Error: Unknown argument: run
```
The rule's *trigger* logic is sound (it does not fire here, correctly — see above); only its
*advice* is wrong, which is arguably worse than a false positive, because a user who trusts the
fix message has no reason to suspect the guidance rather than their own setup.
**Action:** none required beyond the above. Suggested fix is the same: change BG004's fix text to
recommend `--watch=false` unconditionally; drop the `--run` variant or gate it on a builder check.

---

## Rules that should have fired but did not

### Profile-timing gap — every NG rule silently disabled in a session-old workspace
**Rule(s) affected:** all of them (NG007 and every other `hook-lint.sh` rule; the profile gate is checked once,
before any individual rule runs)
**What happened:** `.angular-guide-project.json` is written only by `detect_project.sh`, and that script runs
only on `SessionStart`. This session's `SessionStart` fired before this workspace existed — `detect_project.sh`
exits early when it finds no `angular.json` up-tree — so after scaffolding a brand-new Angular app mid-session,
`hook-lint.sh` line 160 (`[ -n "${PROFILE:-}" ] && [ -f "$PROFILE" ] || exit 0`) found no profile and exited
before evaluating a single rule. I confirmed this directly: writing `src/app/tmp-probe/probe.ts` containing
`export function probe(value: any)` in that state produced **no block and no output at all** — not even a
degraded-mode notice. Every blocking rule was off, silently, with zero signal to the user that anything was
different from a fully-configured workspace. Re-running `detect_project.sh` by hand produced a correct profile
(`angular_major: 22`, `zoneless: true`, `test_runner: "vitest"`, all four v22 gates `true`), and the identical
probe was then blocked correctly with `NG007` on the same content, in the same file, moments later.
**Verdict:** true defect (plugin usability)
**Why this matters:** scaffolding a fresh Angular app in the same session where the plugin was just installed
is the single most likely first action a new user takes. That is exactly the state that disables the plugin
entirely, with no warning — the plugin looks installed and active but enforces nothing. A new user gets zero
value on day one and has no way to know why.
**Suggested fix:** have `hook-lint.sh` attempt detection itself when no profile is found but an `angular.json`
exists up-tree, rather than exiting silently — or, short of that, emit a one-line advisory on the first `Write`
to a `.ts` file in a workspace that has `angular.json` but no `.angular-guide-project.json` yet, so the absence
of enforcement is visible instead of silent.
**Action:** worked around by invoking `detect_project.sh` by hand before proceeding with this task. Every
later task in this project depends on the profile existing — this cannot be re-created retroactively, which is
why it is recorded here rather than left to be rediscovered.

---

## Skill guidance that conflicted with what the code needed

### performance-and-zoneless mandates `@defer (on viewport)`; testing-essentials never mentions defer
**Skill(s):** `performance-and-zoneless` (RULES item 5, and §5 "`@defer` for below-the-fold and
heavy components, with a `@placeholder`"), against `testing-essentials`.
**What the skill says:** RULES item 5 is unconditional — "**`@defer` for below-the-fold and heavy
components**, with a `@placeholder`" — and §5's worked example uses `@defer (on viewport)` as the
trigger, paired with `@placeholder`.
**What the code actually needed:** `on viewport` resolves through `IntersectionObserver`. Angular's
TestBed defaults defer blocks to `DeferBlockBehavior.Playthrough`
(`@angular/core/fesm2022/testing.mjs:135`), i.e. browser-like triggering — but this project's test
environment is jsdom, which provides no `IntersectionObserver` at all (verified:
`new JSDOM('').window.IntersectionObserver` → `undefined`). So a developer who follows the skill's
advice writes a `@defer (on viewport)` block that renders correctly in a browser and is silently
stuck on `@placeholder` under the test runner the plugin itself mandates. The assertion fails with
no indication that the trigger, rather than the component, is the problem.
**Verdict:** true gap in skill guidance
**Why this matters:** the two skills are individually correct and jointly incomplete. `testing-essentials`
contains zero occurrences of "defer". Nothing in the skill set tells you that the recommended trigger
is untestable in the recommended environment, or how to drive it — which is the exact combination the
plugin steers a user into.
**Suggested fix:** add a short section to `testing-essentials` covering defer blocks under TestBed —
set `deferBlockBehavior: DeferBlockBehavior.Manual`, then drive the block explicitly with
`await fixture.getDeferBlocks()` and `await block.render(DeferBlockState.Complete)`. Cross-reference it
from `performance-and-zoneless` §5 so the trigger recommendation and its testing cost appear together.
Worth noting separately: Angular's own `TestModuleMetadata.deferBlockBehavior` docstring
(`types/testing.d.ts:354`) claims the default is `manual`, contradicting the runtime. That is an Angular
documentation bug, not an angular-guide one, but it makes this trap materially harder to diagnose.

### The skills teach how to write a pattern but not how to test it — second instance
**Skill(s):** `data-loading` and `testing-essentials`.
**What the skills say:** `data-loading` is MANDATORY for all HTTP work and steers every async read toward
`httpResource`. `testing-essentials` is MANDATORY for all `.spec.ts` files and mandates Vitest.
**What the code actually needed:** a way to drive an `httpResource` to completion inside a test.
Neither skill provides one. Verified by direct search:
- `testing-essentials/SKILL.md` — zero occurrences of `httpResource`, `whenStable`, `tick`, or `TestBed.tick`.
- `data-loading/SKILL.md` — zero occurrences of `HttpTestingController`, `provideHttpClientTesting`,
  `whenStable`, or `tick`.
So the plugin mandates a data-loading primitive and mandates that you test your code, and is silent on the
intersection. The Task 4 implementer had to trace `HttpResourceImpl`'s internals in `node_modules` to work
out that `TestBed.tick()` plus a microtask flush drives the resource — after discovering that the obvious
call, `TestBed.whenStable()`, does not exist (`whenStable()` is a `ComponentFixture` method,
`@angular/core/types/testing.d.ts:134`; `TestBed` exposes `tick()` at :512).
A second, related surprise with no skill coverage: root-provided `httpResource`s fire **eagerly at service
construction**, not lazily on first `.value()` read. That is correct and desirable for the "created once,
reused across navigation" design the skills encourage — but in a test it means every resource on the service
issues a request the moment it is injected, so specs must disambiguate and drain all of them. Nothing warns you.
**Verdict:** true gap in skill guidance
**Why this matters:** this is the SECOND independent instance of the same shape, after
`performance-and-zoneless` mandating `@defer (on viewport)` while `testing-essentials` never mentions defer
blocks. Two instances make it a pattern rather than an oversight: the skills are written from the authoring
point of view and stop at the point where the code has to be verified. Every mandated pattern a developer
cannot test is a pattern they will either skip or test badly.
**Suggested fix:** give `testing-essentials` a section per mandated async primitive — `httpResource`
(`TestBed.tick()` + microtask flush, `HttpTestingController` draining eagerly-created root resources) and
`@defer` (`deferBlockBehavior: Manual`, `getDeferBlocks()`, `render(DeferBlockState.Complete)`) at minimum —
and cross-reference each from the skill that mandates the pattern, so authoring advice and its testing cost
are never more than one hop apart.

---

## NG014 verdict — is a blocking `[innerHTML]` ban workable?

*(Corrected below — see "Fix round 1" note at the end of this section for what changed
and why.)*

**Rendered:** the corpus is the **nine `angular-guide` SKILL.md files** — the only
markdown this app actually renders through `MdView`. (This project's own `README.md` is
*not* in that corpus: `/rules` parses it into structured `Rule` objects for `rule-card`,
never through the token renderer, and it contains 3 `link` tokens that would have made
the "zero links" claim below false if it had been included.) Rendered via a token tree
produced by `marked`'s lexer, composed into DOM through `MdView` (block dispatcher) and
`MdInline` (inline dispatcher, added beyond the brief). `marked.parser()` is never
called anywhere in `src/app/ui/markdown/` (verified by grep — the only matches are the
comments stating the invariant); no HTML string is built at any point, so there is
nothing for NG014 to have an opinion about, and nothing to sanitize.

**Cost:** 4 components, 282 lines of component source (`md-code.ts` 23, `md-table.ts`
38, `md-inline.ts` 52, `md-view.ts` 169), plus 128 lines of tests (15 cases, all green).
That compares against roughly 5 lines for the rejected alternative — one
`<div [innerHTML]>` bound to `sanitizer.bypassSecurityTrustHtml(marked.parse(md))` plus
its import. The blocking rule bought a ~55x line multiplier, but every one of those
lines is a small, independently testable, statically-typed unit — no `any`, no DOM-shape
guessing at the call site.

**Token types handled — block level** (8-way `@switch`, exhaustive against the corpus):
`heading`, `paragraph`, `code`, `table`, `list`, `blockquote`, `space`, `hr`. Lexing the
nine files with their YAML frontmatter **stripped** (frontmatter is Task 8's concern —
`MdView` correctly renders whatever tokens it is given, and is not the layer that should
strip it) produced **space** 436, **paragraph** 205, **heading** 105, **code** 102,
**list** 20, **table** 4 — **982 block tokens total** once `list_item` (110) is added
back in, **zero unhandled.** `list_item` is not itself a `@switch` case — it is reached
through the `list` case's own recursion, not dispatched at the top level — so it does not
count toward how many of the switch's 8 cases the corpus exercises.

**Two of the eight `@switch` cases are dead code against this corpus, not one.** `hr`
covers **zero** tokens once frontmatter is stripped: all 18 raw `hr` tokens were the
`---` YAML delimiters, not content. `blockquote` also covers **zero** tokens: the corpus
contains no blockquotes at all. An earlier version of this section disclosed only the
`hr` gap and claimed "7 of 8 types in practice" — that count was wrong on two counts: it
silently dropped `blockquote` from the dead list, and it counted `list_item` as one of
the "types in practice" even though it is not a `@switch` case. Corrected: **the corpus
exercises 6 of the 8 `@switch` cases** (`heading`, `paragraph`, `code`, `table`, `list`,
`space`), and two (`hr`, `blockquote`) are dead code against it. Both stay in the
`@switch` because a document containing a genuine `---` rule or a genuine quoted passage
exists in principle, not because this corpus exercises either — it would be dishonest to
count either as coverage. All figures independently re-derived against the installed
`marked@18.0.12`, not assumed.

**Token types handled — inline level** (scope extension beyond the brief): `codespan`,
`strong`, `em` (recursing into nested tokens via `MdInline` importing itself), `text`,
`escape`. The same nine-file corpus produced `text` 883, `codespan` 455, `strong` 88,
`em` 8, `escape` 1 — **1,435 inline tokens, every one handled.** 250 of 420
paragraph/heading/list-item content blocks (**60%**) carry inline markup — nearly all of
it concentrated in list items, where the corpus bolds the lead phrase of almost every
numbered rule (`strong` alone is 88 occurrences, the large majority inside `<li>`s).
Without this extension those blocks would have shown literal backticks and asterisks in
documentation whose entire subject is code syntax. `link` is the one inline type
deliberately left unhandled — genuinely **zero** occurrences in the nine-file corpus
(confirmed after excluding `README.md`, which does contain 3), and it degrades through
`@default` to visible link text with no anchor, rather than vanishing, if one ever
appears.

**What the renderer cannot do:** reference-style links, images, and footnotes — none of
these constructs occurred anywhere in the nine-file corpus, so this is a theoretical gap,
not one the actual content exposed. Two more constructs *look* unsupported but degrade
safely rather than losing content: a nested sub-list inside a list item, and a fenced
code block embedded in a loose list item, both render as their own raw/plain text inline
(unstyled, and a nested sub-list shows as literal markdown syntax like
`"- nested content"` rather than a real nested `<ul>`) instead of vanishing — see the
"list-item silent-drop" fix below; this is intentionally the minimal fix (visible
degradation), not full recursive rendering, and neither shape occurs in this corpus
either. Raw inline/block HTML passthrough is *deliberately* absent — an `html`-type
token (e.g. `<div>…</div>`) falls to `@default` and renders as visible escaped text: that
is NG014's whole point working as intended, not a limitation.

**The one real cost of composing instead of parsing:** `marked`'s own token shape had to
be understood directly rather than trusted to its HTML renderer. A list item's `tokens`
array holds *block-level* wrappers (a `text` token for a tight item, or `paragraph` +
`space` + `code`/`list` for a loose one with embedded content) — this took direct lexer
inspection to discover, including a review-caught bug (below) where a block with no
inline `tokens` of its own (a nested `list`, or a `code` block) fell through to an empty
array and its content silently vanished. Fixed in `listItemTokens()`/`blockAsInline()` in
`md-view.ts`: a block with no inline tokens now falls back to its own text via
`tokenText()`, matching the block-level `@default`'s visible-fallback guarantee instead
of violating it. This is the cost `marked.parser()` would have absorbed silently under
the rejected alternative — composing over the token tree means owning shapes the
HTML-string approach never exposes.

**Verdict:** workable as a blocking rule — the corrected numbers make the case *more*
comfortably than the original ones, not less. Rendering nine real documents, including
60% of content blocks carrying inline markup concentrated in list items, needed 4 small
components and no construct the corpus didn't already exercise (`hr` and `blockquote`
aside, which cost two dead `@case`s, honestly disclosed above). The hardest case — recursive nested markup
(`**bold *and italic* together**`) — needed nothing more exotic than a component
importing itself. The one real defect the design produced — silently dropping a list
item's non-inline block content — was a `listItemTokens()` bug, not a limit of the
composition approach itself, and it was fixable in a few lines because the invariant
("never drop, always degrade visibly") was already the design's stated contract; the bug
was a violation of that contract, not evidence the contract is unreachable. NG014's fix
text ("compose real components instead") was directly actionable, and the composition it
produced is not padding: every component earns its line count against a token type that
genuinely appears in the target content. No hook fired during this task's writes — not
because enforcement was bypassed, but because the design never produced an `[innerHTML]`
binding or a `bypassSecurityTrust*` call to trigger on.

---

**Fix round 1 (post-review correction):** the original version of this section defined
its corpus as "the nine SKILL.md files plus this project's README.md" and, on that
10-file corpus, claimed zero `link` occurrences — false; `README.md` alone has 3. It also
used inline counts (`strong` 9, `codespan` 291) from a script that walked paragraph/
heading blocks only and never descended into list items, undercounting `strong` by
roughly 10x (the corpus's real total is 88, not 9 — nearly all of it inside `<li>`s that
script never visited). Both errors are corrected above: the corpus is now the nine files
actually rendered (README is out — it's parsed into `Rule` objects elsewhere, never
through `MdView`), and every count was re-derived independently against the installed
`marked@18.0.12` rather than taken on faith. The same review also caught the
`listItemTokens()` silent-drop bug described above, with a failing test
(`renders nested list items recursively`, now genuinely nested) added before the fix.
None of the corrections change the verdict; the corrected inline numbers make the case
for the extension's value *stronger* (60% of content blocks carry markup, not 43%), and
the `hr`-is-dead-code disclosure and the fixed silent-drop bug are exactly the kind of
finding this verdict exists to surface honestly rather than paper over.

---

**Fix round 2 (post-review correction, second pass):** the "Fix round 1" correction
above replaced the original wrong inline total (1,545, `text` 993) with what turned out
to be a *second* wrong number in the same spot, also 1,545/993 — reached by tuning my
own re-derivation to match a number I was handed rather than trusting my own first
result. My first independent pass had already produced the correct figures (`text` 883,
total 1,435) before I adjusted the methodology to reproduce the number I was given. The
discrepancy: `marked` wraps a list item's content one level deep
(`item.tokens = [wrapper]`, `wrapper.tokens = [the real inline stream]`); `md-view.ts`'s
`blockAsInline()` discards that wrapper and returns only its children, so the wrapper is
never fed to `<md-inline>` and must not be counted. A generic recursive tree-walk that
counts the wrapper *and* its children overcounts by exactly one phantom `text` token per
list item — 110 list items, 110 extra, 883 + 110 = 993 and 1,435 + 110 = 1,545. Corrected
above to `text` 883, **1,435 inline tokens total**, re-derived by transcribing
`inlineTokens()`/`blockAsInline()`/`listItemTokens()` out of the actual `md-view.ts` and
counting only tokens that reach `<md-inline>` on the real render path — the same
exclusion the verdict already applies to the block-level census, now applied
consistently at the inline level too. Also added a permanent regression test for the
second silent-drop shape (a fenced code block inside a loose list item), previously
verified only by manual trace; it fails against the pre-fix `listItemTokens()` with the
code content missing entirely, and passes with the fix. No other figure or the verdict's
reasoning changed.

---

**Fix round 3 (final whole-branch review correction):** the block-level census above
understated its own dead code. It disclosed `hr` as the one dead `@case` and claimed the
corpus produced "exactly 7 of those types in practice," implicitly counting `list_item`
as a `@switch`-level type. Both were wrong: re-deriving the census directly against the
nine installed `SKILL.md` files with frontmatter stripped shows `blockquote` is also
**zero** — a second dead `@case`, not disclosed before — and `list_item` (110 occurrences)
is reached through the `list` case's own recursion, never dispatched at the top-level
`@switch`, so it is not one of "those types" at all. The corpus therefore exercises **6 of
the 8** `@switch` cases (`heading`, `paragraph`, `code`, `table`, `list`, `space`), not 7,
and two cases (`hr`, `blockquote`) are dead code against it, not one. Corrected above.
Also corrected in the same pass: the test-line/case count (`md-view.spec.ts` had grown to
128 lines and 15 cases since the 119/14 figure was written, from an unrelated later fix
round) and the Task 5 line-count figure quoted in the Summary (267, a pre-fix number —
the actual, still-current total across all four component files is 282, matching the
figure already correct elsewhere in this section). None of these corrections change the
verdict — the corpus still needed no construct it didn't produce, `hr` and `blockquote`
both remain in the `@switch` for the same reason (a document with either construct exists
in principle), and the composition approach's cost/benefit case is unchanged.

---

## Summary

**Hook firings:** 8 total — 2 true positives, 6 false positives, 0 noise. **The ruleset fired
wrongly more often than it fired rightly on this project** — stated plainly rather than left
implicit in a tally. (The count below of "7" through the rest of this section, and its
false-positive breakdown, predates Task 11 of the Spring backend plan; Task 11 added one more
BG004 false positive — a second `npx ng test --help` occurrence — bringing the running total to
8/2/6/0. It also predates the "Detection after monorepo restructure" NG007 entry above, which
was a second confirmation of a true positive already counted rather than a new distinct block,
so it does not change the true-positive count. This note is added rather than rewriting the
historical prose below, to avoid overstating how thoroughly this task re-audited entries it did
not itself produce.)

This count was corrected three times in this final fix wave. First, the original log counted
an entry — `npx ng test --run` (Task 1) — as a true-positive firing that "correctly blocked"
the command. It did not: BG004's own guard source (`bash-guard.sh:135-136`) explicitly exempts
`--run` from its block condition, so that command was accepted, not blocked. Nothing fired.
That entry has been moved to "Defects that are not hook firings" above and merged with the
related "remedy text is wrong" entry, since both describe the same underlying defect — BG004's
*advice*, not its *trigger*, is broken for this toolchain. Removing it drops the count to 5 (2
true positives, 3 false positives). Second, writing this fix wave's own blocker-5 regression
test (a 5-column-table fixture, quoting NG001's trigger text as sample data) reproduced the
NG001 false positive a third time, live, in this session. Third, this fix wave's own `git
commit` describing the first correction above was itself blocked by BG004 — the commit message
prose mentioning `"npx ng test --run"` matched the bare-text trigger, and the exemption check
failed only because `--run` was followed by a closing quote rather than whitespace, `=`, or
end-of-line, which the exemption regex requires. Both are genuine new firings, bringing the
total to 7: 2 true positives, 5 false positives. (The "NG001 addendum" entry above is analysis
of firings already counted here, not an additional firing — it documents *why* the false
positives recur, not a new trigger event.)

- True positives (2): NG007 (Task 1, deliberate probe), NG103 (Task 4, advisory,
  `@Injectable({providedIn:'root'})` → `@Service()`).
- False positives (6): NG001 (Task 3), NG001 (Task 7), NG001 (final fix wave, `rules.spec.ts`),
  BG004 (controller, `ng test --help`), BG004 (final fix wave, `git commit` message prose),
  BG004 (Task 11 of the Spring backend plan, `ng test --help`, second occurrence).
- Noise (0): every firing was either a genuine catch or a genuine miss; nothing fired
  correctly on content not worth interrupting for.

**Rules that fired at all:** NG007, NG001, NG103, BG004 — 4 of the plugin's 30 rules (24
`check_ng*` functions in `hook-lint.sh` plus 6 `BG*` guards in `bash-guard.sh`). The other
26 never triggered across nine implementation tasks plus this controller session and the final
fix wave. That is expected for rules like NG002 (`@NgModule`) and NG011 (`.mutate()`) that only
fire on code no one writing modern Angular would produce — but it is worth stating plainly rather
than waving past: Tasks 2, 5, 6, and Task 7's fix round produced **zero** firings between them,
and Task 5 was the single most template-heavy piece of work in the project — 4 components,
282 lines, landing squarely in the territory NG003 (native control flow), NG005, NG008
(`[class.x]` not `ngClass`), NG009 (`host` object not `@HostBinding`), NG013 (`@for` track),
and NG014 live in. Silence there is not an absence of a result; it is the result — it is
what correct signals-first, template-driven Angular looks like to this ruleset when nobody
is deliberately testing it. A blocking-rule set that never has to speak during genuinely
idiomatic work is doing exactly what it should.

**Rules that should have fired and did not:** none observed — no code was written in this
project that should have tripped a rule and silently passed. The one defect in this
category is structural rather than a missed detection: the "profile-timing gap" entry
above, where every rule in the plugin was silently disabled for the first probe because
`.angular-guide-project.json` hadn't been generated yet. That is a gap in *when* enforcement
turns on, not in what any individual rule catches once it is on.

### Recommended for angular-guide v1.1

| Priority | Rule | Change | Evidence |
|---|---|---|---|
| High | BG004 | Drop the `ng test --run` remedy branch (or gate it on a builder check); recommend `--watch=false` unconditionally | BG004 entries (Task 1, controller remedy-text entry) |
| High | BG004 | Exclude `--help`/`-h`/`--version` forms from the "will hang this session" block | BG004 — `npx ng test --help` (controller) |
| High | NG001 (and the 19 other non-`is_spec`-aware `check_ng*` rules) | Call the existing `is_spec()` helper, or strip string/template-literal contents before matching, so rule-shaped text inside test fixtures stops tripping production-code rules | NG001 (Task 3), NG001 (Task 7), NG001 systemic addendum |
| Medium | `testing-essentials` skill | Add a section on driving `httpResource` to completion in tests (`TestBed.tick()` + microtask flush; `HttpTestingController` draining eagerly-created root resources) | "The skills teach how to write a pattern but not how to test it — second instance" |
| Medium | `testing-essentials` skill | Add a section on `@defer` under TestBed (`deferBlockBehavior: Manual`, `getDeferBlocks()`, `render(DeferBlockState.Complete)`), cross-referenced from `performance-and-zoneless` §5 | "performance-and-zoneless mandates `@defer (on viewport)`; testing-essentials never mentions defer" |
| Low | Plugin bootstrap (`detect_project.sh` / `hook-lint.sh`) | Emit a one-line advisory (or self-invoke detection) when `angular.json` exists but `.angular-guide-project.json` does not, instead of silently disabling every rule | "Profile-timing gap" entry |
| Low | NG103 | No change needed — the advisory correctly identified `@Service()` as the modern equivalent and the fix was a clean drop-in | NG103 (Task 4) |

### Verdict on NG014

See "NG014 verdict — is a blocking `[innerHTML]` ban workable?" above (written by Task 5,
corrected three times under review). Short version: **workable as a blocking rule.** Rendering
nine real skill documents — including 60% of content blocks carrying inline markup —
needed 4 small, independently testable components (282 lines) against a ~5-line rejected
alternative (`[innerHTML]` + `bypassSecurityTrustHtml`), a real cost, but every line earned
its place against a token type the corpus actually exercises, and the one defect the design
produced (a silent-drop bug in `listItemTokens()`) was fixable in a few lines because the
design's own contract ("never drop, always degrade visibly") made the bug detectable. That
verdict is not revisited here — nothing in Tasks 6–9 gave reason to change it.

### Was the plugin worth having?

Yes, on the evidence in this log — narrowly and for a specific reason, not as a blanket
endorsement.

The case for: NG103 changed real code for the better with zero cost — a one-line decorator
swap that the plugin was simply correct about, confirmed against `@angular/core`'s own type
definitions rather than taken on faith. NG007 did exactly its job on the one line written to
test it. And the 26 rules that never fired were silent for the right reason: across the most
template-heavy task in the project (Task 5) and three others, nobody had to argue with the
plugin because nobody wrote the code it exists to catch. A blocking tool that stays quiet
through genuinely idiomatic work, and speaks correctly once when the code was worse than it
should have been, is doing what it was built to do. NG014's cost-benefit (above) reaches the
same conclusion independently: the ban was expensive in lines but not in quality, and it
prevented a real unsanitized-HTML pathway from ever existing in this codebase.

The case against, stated as plainly: every *false* signal in this log was self-inflicted by
the plugin's own implementation gaps, not by ambiguity in what "correct Angular" means. Three
NG001 false positives — the third one reproduced live during this very fix wave, while writing
a regression test for an unrelated blocker — came from one uncorrected root cause (spec files
never exempted from a bare-text regex) that the plugin's own author already half-solved with
`is_spec()` and then applied to only 4 of 24 rules. Both of the plugin's actual BG004 firings
were false positives — `ng test --help` (which cannot hang a session at all) and, in this very
fix wave, a `git commit` whose message merely *described* `ng test --run` in prose, blocked
because BG004 scans raw command text for the bare substring with no awareness of quoting or
heredoc content, the same defect class as the NG001 false positives above. A related defect —
BG004's remedy text recommending a `--run` flag that does not work on this toolchain, verified
directly against this workspace's builder — is real but is not a firing at all, since BG004's
own guard exempts `--run` and never blocks it. Either way, a user who trusts that remedy text
hits a second wall with no signal that the *advice*, not their setup, is wrong. And the largest
cost this project paid to
the plugin was not a blocking rule at all: it was the skill set's own silence on how to test
the async primitives it mandates (`httpResource`, `@defer`), which downstream shipped defective
test code in **six of nine tasks** — vacuous "never throws" assertions, a nonexistent
`TestBed.whenStable()` call, a mismatched default-branch test, a flat "nested list" test, and
synchronous callbacks racing microtask-resolved resources. Only two of those five defect kinds
— the nonexistent `TestBed.whenStable()` call and the synchronous callbacks racing
microtask-resolved resources — trace directly to the skills' silence on async primitives. The
other three — the vacuous "never throws" assertions (Tasks 2 and 3) and the tautological
`@default`-branch test and flat "nested list" test (both Task 5) — are ordinary
unfalsifiable-test defects unrelated to async timing at all, a general pattern the skills also
do not address. Every one of the six was caught by review, none by the plugin's own hooks or
skills, because nothing in `testing-essentials` covers either gap.

Net: the blocking and advisory rules that actually ran — NG007, NG001, NG103, BG004 — earned
their keep or, where they didn't, failed in ways that are cheap to fix (an `is_spec()` call,
a corrected remedy string, an argument exclusion) rather than ways that indict the underlying
idea. The skill-guidance gap is the more serious finding of the two, because it isn't a bug
in a regex — it's a structural blind spot in what the plugin considers its job to cover, and
it cost more real defects across this project than every hook firing combined, even after
narrowing that count to the two defect kinds actually caused by it. If `angular-guide` closes
that gap, this log supports keeping the plugin as-is; if it doesn't, the next project built
under it should expect the same pattern to repeat.
