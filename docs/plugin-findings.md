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

### BG004 — `npx ng test --run` (Task 1 verification step)
**Code:** `npx ng test --run` (as literally specified in the Task 1 brief)
**Verdict:** true positive, with an inaccurate remedy for this toolchain version
**Why:** BG004 correctly blocks bare `ng test` (which defaults to watch mode and hangs a non-interactive
session). `npx ng test --run` was accepted by the guard — it treats `--run` as satisfying the rule — but
Angular v22.1.7's `@angular/build:unit-test` builder (the wrapper `ng test` invokes) rejected it outright with
`Error: Unknown argument: run`. The guard's own suggested fix text — "Run `ng test --watch=false` (Karma) or
`ng test --run` (Vitest)" — offers `--run` as the Vitest-flavored alternative, but at this builder version the
Angular CLI wrapper does not pass unknown flags through to the underlying Vitest binary, so `--run` fails
before Vitest ever sees it. `--watch=false` is the one that actually works here.
**Action:** used `npx ng test --watch=false` for all test runs in this task; tests passed (see report).

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

_(none yet)_
