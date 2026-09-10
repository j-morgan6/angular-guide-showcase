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

---

## NG014 verdict — is a blocking `[innerHTML]` ban workable?

**Rendered:** the nine `angular-guide` SKILL.md documents plus this project's own
`README.md` — 10 real markdown files — via a token tree produced by `marked`'s lexer,
composed into DOM through `MdView` (block dispatcher) and `MdInline` (inline dispatcher,
added beyond the brief). `marked.parser()` is never called anywhere in
`src/app/ui/markdown/` (verified by grep — the only matches are the comments that state
the invariant); no HTML string is built at any point, so there is nothing for NG014 to
have an opinion about, and nothing to sanitize.

**Cost:** 4 components, 267 lines of component source (`md-code.ts` 23, `md-table.ts` 38,
`md-inline.ts` 52, `md-view.ts` 154), plus 114 lines of tests (14 cases, all green). That
compares against roughly 5 lines for the rejected alternative — one `<div [innerHTML]>`
bound to `sanitizer.bypassSecurityTrustHtml(marked.parse(md))` plus its import. The
blocking rule bought a ~50x line multiplier, but every one of those lines is a small,
independently testable, statically-typed unit — no `any`, no DOM-shape guessing at the
call site.

**Token types handled — block level (8-way `@switch`, exhaustive against the corpus):**
`heading`, `paragraph`, `code`, `table`, `list`, `blockquote`, `space`, `hr`. Lexing all
10 files produced exactly these 7 types in practice (space 436, paragraph 214, heading
105, code 102, list 29, hr 18, table 4 — 908 block tokens total) — **zero unhandled**,
independently re-measured against the installed `marked@18.0.12`, not assumed.

**Token types handled — inline level (scope extension beyond the brief):** `codespan`,
`strong`, `em` (recursing into nested tokens via `MdInline` importing itself), `text`,
`escape`. The same 10-file corpus produced text 622, codespan 291, strong 9, em 8,
escape 1 — every one handled. 137 of 319 paragraph/heading blocks (43%) carry inline
markup; without this extension those blocks would have shown literal backticks and
asterisks in documentation whose entire subject is code syntax. `link` is the one inline
type deliberately left unhandled — zero occurrences in the corpus, and it degrades
through `@default` to visible link text with no anchor, rather than vanishing, if one
ever appears.

**What the renderer cannot do:** reference-style links, images, footnotes, and multiple
paragraphs within one loose list item (its inline tokens are concatenated, so a second
paragraph in the same `<li>` loses its paragraph break but keeps its markup and its
text) — none of these constructs occurred anywhere in the 10-file corpus, so this is a
theoretical gap, not one the actual content exposed. Raw inline/block HTML passthrough
is *deliberately* absent — an `html`-type token (e.g. `<div>…</div>`) falls to
`@default` and renders as visible escaped text — see the plugin-findings entry this
verdict sits under: that is NG014's whole point working as intended, not a limitation.

**The one real cost of composing instead of parsing:** `marked`'s own token shape had to
be understood directly rather than trusted to its HTML renderer. A list item's `tokens`
array holds a *block-level* wrapper (usually one `text`-typed token), and the genuinely
inline stream is one level deeper, on that wrapper's own `tokens` — this took direct
lexer inspection to discover (see `listItemTokens()` in `md-view.ts`) and would have
been invisible plumbing inside `marked.parser()` under the rejected alternative. This
was the single non-obvious step in the whole task; everything else mapped onto
`@switch`/`@for` directly.

**Verdict:** workable as a blocking rule — not merely tolerable, actually well-suited to
this problem. Rendering 10 real documents, including 43% of blocks carrying inline
markup, needed 4 small components and no construct the corpus didn't already exercise.
The hardest case — recursive nested markup (`**bold *and italic* together**`) — needed
nothing more exotic than a component importing itself. NG014's fix text ("compose real
components instead") was directly actionable and the composition it produced is not
padding: every component earns its line count by handling a token type that genuinely
appears in the target content. No hook fired during this task's writes — not because
enforcement was bypassed, but because the design never produced an `[innerHTML]` binding
or a `bypassSecurityTrust*` call to trigger on.
