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
38, `md-inline.ts` 52, `md-view.ts` 169), plus 119 lines of tests (14 cases, all green).
That compares against roughly 5 lines for the rejected alternative — one
`<div [innerHTML]>` bound to `sanitizer.bypassSecurityTrustHtml(marked.parse(md))` plus
its import. The blocking rule bought a ~55x line multiplier, but every one of those
lines is a small, independently testable, statically-typed unit — no `any`, no DOM-shape
guessing at the call site.

**Token types handled — block level** (8-way `@switch`, exhaustive against the corpus):
`heading`, `paragraph`, `code`, `table`, `list`, `blockquote`, `space`, `hr`. Lexing the
nine files with their YAML frontmatter **stripped** (frontmatter is Task 8's concern —
`MdView` correctly renders whatever tokens it is given, and is not the layer that should
strip it) produced exactly 7 of those types in practice — `space` 436, `paragraph` 205,
`list_item` 110, `heading` 105, `code` 102, `list` 20, `table` 4, **982 block tokens
total, zero unhandled.** `hr` covers **zero** tokens in the real corpus once frontmatter
is stripped: all 18 raw `hr` tokens were the `---` YAML delimiters, not content. That
`@case` is dead code against this corpus, and it would be dishonest to count it as
coverage — it stays in the `@switch` because a document with a genuine `---` rule exists
in principle, not because this corpus exercises it. All figures independently re-derived
against the installed `marked@18.0.12`, not assumed.

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
components and no construct the corpus didn't already exercise (`hr` aside, which costs
one dead `@case`, honestly disclosed above). The hardest case — recursive nested markup
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
