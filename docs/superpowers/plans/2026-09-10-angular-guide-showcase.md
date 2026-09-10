# angular-guide-showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Angular v22 dashboard that displays the `angular-guide` plugin it was built by, while recording every hook firing as real-code validation of that plugin.

**Architecture:** Three lazily-loaded routes over the GitHub API, reading `angular-guide`'s own repository live. Pure parsing functions in `core/parsing/` (no Angular dependency), one API service in `core/github/`, and a recursive token-tree markdown renderer in `ui/markdown/` that never constructs an HTML string — because NG014 blocks `[innerHTML]` outright and this is the composition its fix text prescribes.

**Tech Stack:** Angular v22 (standalone, zoneless, signals, OnPush by default), Vitest, `marked` (lexer only), plain CSS, GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-angular-guide-showcase-design.md`

## PREREQUISITE — do this before Task 1

`angular-guide` must be installed and active in Claude Code, or no hooks fire and the validation this project exists for does not happen:

```
/plugin marketplace add j-morgan6/angular-guide
```

Then restart Claude Code. Task 1 verifies the hooks are live empirically rather than assuming it.

## Global Constraints

Every task's requirements implicitly include this section.

- **Angular v22**, standalone, zoneless, signals-first. `ng new` in v22 already defaults to zoneless, Vitest, and OnPush — do not add flags for them, and do not set `changeDetection` explicitly (NG006 blocks it).
- **The plugin's rules are binding on this code.** They will block writes. That is the point. When a rule blocks something you believe is correct, **do not work around it silently** — record it in `docs/plugin-findings.md` with a verdict, then either comply or record why compliance was impossible.
- **No `[innerHTML]`, ever** (NG014). No `bypassSecurityTrust*` (NG015).
- **No secrets, no GitHub token.** All API calls are unauthenticated (NG016).
- **No `any`** (NG007). Use `unknown` and narrow.
- `inject()` not constructor DI (NG004); `input()`/`output()` not decorators (NG005); native control flow `@if`/`@for`/`@switch` (NG003); every `@for` needs `track` (NG013); `[class.x]`/`[style.x]` not `ngClass`/`ngStyle` (NG008); `host` object not `@HostBinding`/`@HostListener` (NG009).
- **Never `.subscribe()` without teardown** (NG010) — prefer `httpResource`, `toSignal`, or the `async` pipe.
- **Never write a signal inside `effect()`** (NG012) — `computed()` for derived state.
- **Lazy-load every feature route** (NG101).
- **Package manager is npm** (no pnpm on this machine; BG003 enforces consistency with the lockfile).
- **Run tests non-interactively**: `npx ng test --run` (BG004 blocks watch mode).
- Node 26.5.0, npm 11.17.0, no global `ng` — invoke via `npx`.
- Repo: `/Users/joser/Development/angular-guide-showcase`, remote `github.com/j-morgan6/angular-guide-showcase`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/app/core/parsing/markdown.ts` | `marked.lexer` wrapper → `MdToken[]`. Pure. |
| `src/app/core/parsing/rules.ts` | README markdown → `Rule[]`. Pure. |
| `src/app/core/parsing/base64.ts` | GitHub base64 content → UTF-8 string. Pure. |
| `src/app/core/github/github-api.ts` | The only file that knows about GitHub. `httpResource`s, rate-limit state, `sessionStorage` cache. |
| `src/app/core/github/github.types.ts` | `RepoMeta`, `Commit`, `Contributor`, `RateLimit`. |
| `src/app/ui/markdown/md-view.ts` | Recursive token dispatcher (`@switch` on token type). |
| `src/app/ui/markdown/md-code.ts` | Fenced code block. |
| `src/app/ui/markdown/md-table.ts` | Table token. |
| `src/app/ui/state/` | `loading.ts`, `error-state.ts` — shared loading / rate-limited / failed presentation. |
| `src/app/features/rules/` | `rules-page.ts` (container), `rule-list.ts`, `rule-card.ts`, `rule-filters.ts`. |
| `src/app/features/skills/` | `skills-page.ts` (container), `skill-doc.ts`. |
| `src/app/features/activity/` | `activity-page.ts` (container), `commit-list.ts`, `contributor-card.ts`. |
| `src/app/app.routes.ts` | Three lazy routes. |
| `docs/plugin-findings.md` | The validation deliverable. One entry per hook firing. |
| `.github/workflows/deploy.yml` | Build + publish to GitHub Pages. |

Parsing is separated from Angular entirely so it can be tested as plain functions — it is the novel logic and deserves the heaviest coverage. `github-api.ts` is the single place that knows about base64, rate-limit headers, and caching, so no feature component ever deals with transport concerns.

---

### Task 1: Workspace scaffold, plugin verification, findings log

**Files:**
- Create: the Angular workspace at repo root (via `ng new`)
- Create: `docs/plugin-findings.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working Angular v22 workspace; `npx ng build` and `npx ng test --run` both green; `docs/plugin-findings.md` with the heading structure every later task appends to.

- [ ] **Step 1: Scaffold the workspace**

The repo already contains `.git`, `.gitignore`, and `docs/`. `ng new` refuses a non-empty directory, so scaffold in a temp dir and move the contents in:

```bash
cd /tmp && rm -rf ags-scaffold && mkdir ags-scaffold && cd ags-scaffold
npx --yes @angular/cli@22 new showcase --style=css --ssr=false --skip-git --package-manager=npm
cd /Users/joser/Development/angular-guide-showcase
rsync -a --exclude='.git' /tmp/ags-scaffold/showcase/ ./
rm -rf /tmp/ags-scaffold
```

- [ ] **Step 2: Verify the scaffold builds and tests**

```bash
npm install
npx ng build
npx ng test --run
```

Expected: build succeeds; the default `app.spec.ts` passes. If `ng test` hangs, you omitted `--run` — BG004 exists to prevent exactly that.

- [ ] **Step 3: Verify the plugin's hooks are actually live**

This is the whole premise of the project, so prove it rather than assume it. Write a file that violates a rule you can predict:

```bash
mkdir -p src/app/tmp-probe
```

Then use the Write tool (not bash) to create `src/app/tmp-probe/probe.ts` containing:

```typescript
export function probe(value: any) {
  return value;
}
```

Expected: **the write is BLOCKED** with `🚫 NG007: \`any\` type detected.` on stderr.

If it is *not* blocked, stop and report `BLOCKED` — the plugin is not installed or not active, and every later task's validation value is zero. Do not proceed.

If it is blocked, that is success. Record it as the first findings entry (Step 5), then confirm the directory is empty and remove it:

```bash
rmdir src/app/tmp-probe
```

- [ ] **Step 4: Confirm the workspace profile was detected**

```bash
cat .angular-guide-project.json
```

Expected: `"angular_major": 22`, `"zoneless": true`, `"test_runner": "vitest"`, and the four v22 gates all `true`. If the file is absent, the SessionStart hook did not run — restart Claude Code and re-check. If `angular_major` is `"unknown"`, the version parse failed and every gated rule is silently off; report that as a finding immediately.

- [ ] **Step 5: Create the findings log**

Create `docs/plugin-findings.md`:

```markdown
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
**Why:** deliberate probe to confirm the hooks are live before starting. Blocked as expected.
**Action:** none — file removed.

---

## Rules that should have fired but did not

_(none yet)_

---

## Skill guidance that conflicted with what the code needed

_(none yet)_
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Angular v22 workspace and findings log"
```

---

### Task 2: Markdown lexing — `core/parsing/markdown.ts`

**Files:**
- Create: `src/app/core/parsing/markdown.ts`
- Test: `src/app/core/parsing/markdown.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type MdToken = Token` (re-exported from `marked`)
  - `lexMarkdown(src: string): MdToken[]` — never throws; returns `[]` on unparseable input.
  - `tokenText(token: MdToken): string` — best-effort plain text for a token, used by tests and by `md-view`'s fallback branch.

- [ ] **Step 1: Install marked**

```bash
npm install marked@^18
```

- [ ] **Step 2: Write the failing test**

Create `src/app/core/parsing/markdown.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { lexMarkdown, tokenText } from './markdown';

describe('lexMarkdown', () => {
  it('returns a heading token with its depth and text', () => {
    const tokens = lexMarkdown('# Title');
    expect(tokens[0].type).toBe('heading');
    expect(tokens[0]).toMatchObject({ depth: 1, text: 'Title' });
  });

  it('returns a fenced code token carrying its language', () => {
    const tokens = lexMarkdown('```typescript\nconst a = 1;\n```');
    expect(tokens[0]).toMatchObject({ type: 'code', lang: 'typescript' });
  });

  it('returns a table token with header and rows', () => {
    const tokens = lexMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(tokens[0].type).toBe('table');
  });

  it('returns an empty array for empty input', () => {
    expect(lexMarkdown('')).toEqual([]);
  });

  it('never throws on malformed input', () => {
    expect(() => lexMarkdown('```unterminated\n\n| broken |')).not.toThrow();
  });

  it('extracts plain text from a token', () => {
    const tokens = lexMarkdown('Some **bold** text');
    expect(tokenText(tokens[0])).toContain('bold');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `src/app/core/parsing/markdown` cannot be resolved.

- [ ] **Step 4: Write the implementation**

Create `src/app/core/parsing/markdown.ts`:

```typescript
import { lexer, type Token } from 'marked';

/** A lexed markdown token. Re-exported so nothing else imports from `marked` directly. */
export type MdToken = Token;

/**
 * Lex markdown into a token tree.
 *
 * We deliberately never call `marked.parser()` — that is the step that would
 * produce an HTML string, and NG014 blocks binding HTML into the DOM. Rendering
 * happens by composing components over these tokens instead, so no HTML string
 * is ever constructed and there is nothing to sanitise.
 *
 * Never throws: malformed markdown yields whatever tokens were recoverable.
 */
export function lexMarkdown(src: string): MdToken[] {
  if (!src) {
    return [];
  }
  try {
    return lexer(src);
  } catch {
    return [];
  }
}

/** Best-effort plain text for a token, for fallback rendering and assertions. */
export function tokenText(token: MdToken): string {
  if ('text' in token && typeof token.text === 'string') {
    return token.text;
  }
  if ('raw' in token && typeof token.raw === 'string') {
    return token.raw;
  }
  return '';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx ng test --run`
Expected: PASS — 6 tests in `markdown.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/parsing/markdown.ts src/app/core/parsing/markdown.spec.ts package.json package-lock.json
git commit -m "feat: markdown lexer wrapper returning a token tree"
```

---

### Task 3: README rule parsing — `core/parsing/rules.ts`

Parses the plugin's own README into structured rules. The tables have a fixed four-column shape — ID, trigger, fix, gate — repeated across three sections (`BG`, `NG0xx` blocking, `NG1xx` advisory).

**Files:**
- Create: `src/app/core/parsing/rules.ts`
- Test: `src/app/core/parsing/rules.spec.ts`

**Interfaces:**
- Consumes: `lexMarkdown`, `MdToken` from Task 2.
- Produces:
  - `type RuleKind = 'bash' | 'blocking' | 'advisory'`
  - `interface Rule { id: string; kind: RuleKind; trigger: string; fix: string; gate: string }`
  - `parseRules(readme: string): Rule[]` — never throws; returns `[]` when no rule tables are found.
  - `class RuleParseError extends Error` — carries `expected: string`, thrown only by `parseRulesOrThrow`.
  - `parseRulesOrThrow(readme: string): Rule[]` — for the container to surface a legible parse failure.

- [ ] **Step 1: Write the failing test**

Create `src/app/core/parsing/rules.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { parseRules, parseRulesOrThrow, RuleParseError, type Rule } from './rules';

const README = `
## Bash rules

| ID | Catches | Fix | Gate |
|---|---|---|---|
| BG002 | \`ng build --prod\` | Run \`ng build\`. | none |
| BG004 | \`ng test\` without a no-watch flag | Add \`--watch=false\`. | none |

## Blocking rules

| ID | Catches | Fix | Gate |
|---|---|---|---|
| NG001 | \`standalone: true\` in a decorator | Delete the property. | v20+ |
| NG006 | Explicit \`OnPush\` | Delete it — default in v22. | v22+ |

## Advisory rules

| ID | Catches | Fix | Gate |
|---|---|---|---|
| NG101 | An eager \`component:\` route | Use \`loadComponent\`. | none |
`;

describe('parseRules', () => {
  it('extracts every rule across all three tables', () => {
    const rules = parseRules(README);
    expect(rules.map((r) => r.id)).toEqual(['BG002', 'BG004', 'NG001', 'NG006', 'NG101']);
  });

  it('classifies rules by their ID prefix and number', () => {
    const byId = new Map(parseRules(README).map((r) => [r.id, r]));
    expect(byId.get('BG002')?.kind).toBe('bash');
    expect(byId.get('NG001')?.kind).toBe('blocking');
    expect(byId.get('NG101')?.kind).toBe('advisory');
  });

  it('captures trigger, fix and gate text', () => {
    const ng006 = parseRules(README).find((r) => r.id === 'NG006') as Rule;
    expect(ng006.trigger).toContain('OnPush');
    expect(ng006.fix).toContain('default in v22');
    expect(ng006.gate).toBe('v22+');
  });

  it('returns an empty array when no rule tables are present', () => {
    expect(parseRules('# Just a heading\n\nSome prose.')).toEqual([]);
  });

  it('never throws on malformed input', () => {
    expect(() => parseRules('| broken |\n|---|\n')).not.toThrow();
  });

  it('ignores table rows whose first cell is not a rule ID', () => {
    const withNoise = README + '\n| Notes | x | y | z |\n';
    expect(parseRules(withNoise).map((r) => r.id)).not.toContain('Notes');
  });
});

describe('parseRulesOrThrow', () => {
  it('throws RuleParseError naming what it expected when nothing parses', () => {
    try {
      parseRulesOrThrow('# No tables here');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RuleParseError);
      expect((err as RuleParseError).expected).toContain('four-column');
    }
  });

  it('returns rules when parsing succeeds', () => {
    expect(parseRulesOrThrow(README)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./rules` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/app/core/parsing/rules.ts`:

```typescript
import { lexMarkdown, type MdToken } from './markdown';

export type RuleKind = 'bash' | 'blocking' | 'advisory';

export interface Rule {
  readonly id: string;
  readonly kind: RuleKind;
  readonly trigger: string;
  readonly fix: string;
  readonly gate: string;
}

/** Thrown by parseRulesOrThrow so a view can explain what shape it expected. */
export class RuleParseError extends Error {
  constructor(readonly expected: string) {
    super(`Could not parse rules: expected ${expected}`);
    this.name = 'RuleParseError';
  }
}

const RULE_ID = /^(BG|NG)(\d{3})$/;

function classify(prefix: string, num: number): RuleKind {
  if (prefix === 'BG') {
    return 'bash';
  }
  return num >= 100 ? 'advisory' : 'blocking';
}

/** Markdown table cells arrive as objects carrying `text`; normalise to a string. */
function cellText(cell: unknown): string {
  if (typeof cell === 'string') {
    return cell.trim();
  }
  if (cell && typeof cell === 'object' && 'text' in cell) {
    const text = (cell as { text: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
}

function rowsOf(token: MdToken): unknown[][] {
  if (token.type !== 'table' || !('rows' in token)) {
    return [];
  }
  const rows = (token as { rows: unknown }).rows;
  return Array.isArray(rows) ? (rows as unknown[][]) : [];
}

/**
 * Parse the rule tables out of angular-guide's README.
 *
 * Every rule table is four columns — ID, what it catches, the fix, the version
 * gate — so a row is a rule exactly when its first cell is a rule ID. Rows that
 * are not (prose tables elsewhere in the README) are skipped rather than
 * treated as errors.
 *
 * Never throws. Returns [] when nothing matches.
 */
export function parseRules(readme: string): Rule[] {
  const rules: Rule[] = [];

  for (const token of lexMarkdown(readme)) {
    for (const row of rowsOf(token)) {
      if (row.length < 4) {
        continue;
      }
      const id = cellText(row[0]);
      const match = RULE_ID.exec(id);
      if (!match) {
        continue;
      }
      rules.push({
        id,
        kind: classify(match[1], Number(match[2])),
        trigger: cellText(row[1]),
        fix: cellText(row[2]),
        gate: cellText(row[3]),
      });
    }
  }

  return rules;
}

/** As parseRules, but throws RuleParseError when nothing parsed. */
export function parseRulesOrThrow(readme: string): Rule[] {
  const rules = parseRules(readme);
  if (rules.length === 0) {
    throw new RuleParseError(
      'a four-column markdown table (ID | catches | fix | gate) with rows whose first cell is a rule ID like NG001',
    );
  }
  return rules;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --run`
Expected: PASS — 8 tests in `rules.spec.ts`.

- [ ] **Step 5: Verify against the real README**

The parser's whole job is reading a document this repo does not control. Prove it works on the actual file:

```bash
curl -s https://raw.githubusercontent.com/j-morgan6/angular-guide/master/README.md -o /tmp/real-readme.md
wc -l /tmp/real-readme.md
```

Add a test that reads that fixture. Copy it into the repo so the suite stays hermetic:

```bash
mkdir -p src/app/core/parsing/__fixtures__
cp /tmp/real-readme.md src/app/core/parsing/__fixtures__/angular-guide-readme.md
```

Append to `rules.spec.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('parseRules against the real angular-guide README', () => {
  const real = readFileSync(
    join(__dirname, '__fixtures__', 'angular-guide-readme.md'),
    'utf8',
  );

  it('finds all 30 rules', () => {
    expect(parseRules(real)).toHaveLength(30);
  });

  it('finds 6 bash, 18 blocking and 6 advisory rules', () => {
    const rules = parseRules(real);
    const count = (kind: RuleKind) => rules.filter((r) => r.kind === kind).length;
    expect(count('bash')).toBe(6);
    expect(count('blocking')).toBe(18);
    expect(count('advisory')).toBe(6);
  });

  it('gives every rule a non-empty trigger and fix', () => {
    for (const rule of parseRules(real)) {
      expect(rule.trigger, `${rule.id} trigger`).not.toBe('');
      expect(rule.fix, `${rule.id} fix`).not.toBe('');
    }
  });
});
```

Run: `npx ng test --run`
Expected: PASS. If the counts are wrong, the parser is wrong — fix it before continuing; every downstream view depends on this.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/parsing/
git commit -m "feat: parse angular-guide rule tables from its README"
```

---

### Task 4: GitHub API service — `core/github/`

The only file that knows about GitHub. Everything above it sees signals.

**Deliberate simplification from the spec.** §6 proposed a `sessionStorage` cache so a session costs ~4 requests rather than 4 per view. That is unnecessary: the service is `providedIn: 'root'`, so its `httpResource`s are created once and survive navigation — returning to `/rules` reuses the existing resource rather than refetching. `sessionStorage` would only help across a full page reload, which is not worth the serialisation code or the staleness question. Record this in the report; it is a simplification, not an omission.

**Files:**
- Create: `src/app/core/parsing/base64.ts`
- Create: `src/app/core/parsing/base64.spec.ts`
- Create: `src/app/core/github/github.types.ts`
- Create: `src/app/core/github/github-api.ts`
- Create: `src/app/core/github/github-api.spec.ts`
- Modify: `src/app/app.config.ts` (add `provideHttpClient`)

**Interfaces:**
- Consumes: nothing from earlier tasks (parsing is used by callers, not here).
- Produces:
  - `decodeBase64(content: string): string` — GitHub base64 (with newlines) → UTF-8.
  - `interface RepoMeta { name: string; description: string; stars: number; forks: number; openIssues: number; pushedAt: string }`
  - `interface Commit { sha: string; message: string; authorName: string; authorAvatarUrl: string; date: string; url: string }`
  - `interface Contributor { login: string; avatarUrl: string; contributions: number; url: string }`
  - `GithubApi` service, `providedIn: 'root'`, exposing:
    - `readonly repo` — `HttpResourceRef<RepoMeta | undefined>`
    - `readonly commits` — `HttpResourceRef<Commit[] | undefined>`
    - `readonly contributors` — `HttpResourceRef<Contributor[] | undefined>`
    - `readonly readme` — `HttpResourceRef<string | undefined>` (decoded)
    - `skillDoc(name: Signal<string | undefined>)` → `HttpResourceRef<string | undefined>` (decoded)
    - `readonly isRateLimited: Signal<boolean>`

- [ ] **Step 1: Write the failing base64 test**

Create `src/app/core/parsing/base64.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { decodeBase64 } from './base64';

describe('decodeBase64', () => {
  it('decodes plain base64', () => {
    expect(decodeBase64('aGVsbG8=')).toBe('hello');
  });

  it('ignores the newlines GitHub inserts every 60 characters', () => {
    const withNewlines = 'aGVs\nbG8=';
    expect(decodeBase64(withNewlines)).toBe('hello');
  });

  it('round-trips multi-byte UTF-8', () => {
    const source = '# Título — 🚫 blocked';
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(source)));
    expect(decodeBase64(encoded)).toBe(source);
  });

  it('returns an empty string for empty input', () => {
    expect(decodeBase64('')).toBe('');
  });

  it('never throws on invalid base64', () => {
    expect(() => decodeBase64('!!!not base64!!!')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./base64` cannot be resolved.

- [ ] **Step 3: Write base64**

Create `src/app/core/parsing/base64.ts`:

```typescript
/**
 * Decode GitHub's base64 file content to a UTF-8 string.
 *
 * The contents API wraps base64 at 60 characters, and `atob` rejects the
 * embedded newlines, so they are stripped first. `atob` yields one char per
 * byte, so the bytes are re-decoded as UTF-8 to keep multi-byte characters
 * intact — the plugin's own docs are full of emoji and em-dashes.
 *
 * Never throws: invalid input yields an empty string.
 */
export function decodeBase64(content: string): string {
  if (!content) {
    return '';
  }
  try {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --run`
Expected: PASS — 5 tests in `base64.spec.ts`.

- [ ] **Step 5: Write the types**

Create `src/app/core/github/github.types.ts`:

```typescript
export interface RepoMeta {
  readonly name: string;
  readonly description: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly pushedAt: string;
}

export interface Commit {
  readonly sha: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string;
  readonly date: string;
  readonly url: string;
}

export interface Contributor {
  readonly login: string;
  readonly avatarUrl: string;
  readonly contributions: number;
  readonly url: string;
}
```

- [ ] **Step 6: Write the failing service test**

Create `src/app/core/github/github-api.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GithubApi } from './github-api';

describe('GithubApi', () => {
  let api: GithubApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GithubApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests repo metadata from the angular-guide repo', async () => {
    api.repo.value();
    await TestBed.whenStable();
    const req = http.expectOne((r) => r.url.includes('/repos/j-morgan6/angular-guide'));
    expect(req.request.method).toBe('GET');
    req.flush({
      name: 'angular-guide',
      description: 'Enforce modern Angular',
      stargazers_count: 3,
      forks_count: 1,
      open_issues_count: 0,
      pushed_at: '2026-09-07T00:00:00Z',
    });
    expect(api.repo.value()).toMatchObject({ name: 'angular-guide', stars: 3 });
  });

  it('sends no Authorization header — the app is unauthenticated by design', async () => {
    api.repo.value();
    await TestBed.whenStable();
    const req = http.expectOne((r) => r.url.includes('/repos/'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('decodes README content from base64', async () => {
    api.readme.value();
    await TestBed.whenStable();
    const req = http.expectOne((r) => r.url.includes('/contents/README.md'));
    req.flush({ content: btoa('# Hello'), encoding: 'base64' });
    expect(api.readme.value()).toBe('# Hello');
  });

  it('reports rate limiting when a 403 carries zero remaining', async () => {
    api.repo.value();
    await TestBed.whenStable();
    const req = http.expectOne((r) => r.url.includes('/repos/'));
    req.flush('rate limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0' },
    });
    expect(api.isRateLimited()).toBe(true);
  });

  it('does not report rate limiting for an ordinary failure', async () => {
    api.repo.value();
    await TestBed.whenStable();
    const req = http.expectOne((r) => r.url.includes('/repos/'));
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    expect(api.isRateLimited()).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./github-api` cannot be resolved.

- [ ] **Step 8: Write the service**

Create `src/app/core/github/github-api.ts`:

```typescript
import { computed, Injectable, type Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { decodeBase64 } from '../parsing/base64';
import type { Commit, Contributor, RepoMeta } from './github.types';

const REPO = 'j-morgan6/angular-guide';
const API = 'https://api.github.com';

/** GitHub's contents API response shape, narrowed to what we read. */
interface ContentsResponse {
  readonly content?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

@Injectable({ providedIn: 'root' })
export class GithubApi {
  /**
   * Resources are created once at root scope, so navigating between routes
   * reuses them instead of refetching. That keeps a session inside GitHub's
   * 60-requests-per-hour unauthenticated budget without a manual cache.
   */
  readonly repo = httpResource<RepoMeta>(() => `${API}/repos/${REPO}`, {
    parse: (raw: unknown): RepoMeta => {
      const r = asRecord(raw);
      return {
        name: str(r['name']),
        description: str(r['description']),
        stars: num(r['stargazers_count']),
        forks: num(r['forks_count']),
        openIssues: num(r['open_issues_count']),
        pushedAt: str(r['pushed_at']),
      };
    },
  });

  readonly commits = httpResource<Commit[]>(
    () => `${API}/repos/${REPO}/commits?per_page=30`,
    {
      parse: (raw: unknown): Commit[] => {
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw.map((entry) => {
          const e = asRecord(entry);
          const commit = asRecord(e['commit']);
          const author = asRecord(commit['author']);
          const ghAuthor = asRecord(e['author']);
          return {
            sha: str(e['sha']).slice(0, 7),
            message: str(commit['message']).split('\n')[0],
            authorName: str(author['name']),
            authorAvatarUrl: str(ghAuthor['avatar_url']),
            date: str(author['date']),
            url: str(e['html_url']),
          };
        });
      },
    },
  );

  readonly contributors = httpResource<Contributor[]>(
    () => `${API}/repos/${REPO}/contributors`,
    {
      parse: (raw: unknown): Contributor[] => {
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw.map((entry) => {
          const c = asRecord(entry);
          return {
            login: str(c['login']),
            avatarUrl: str(c['avatar_url']),
            contributions: num(c['contributions']),
            url: str(c['html_url']),
          };
        });
      },
    },
  );

  readonly readme = httpResource<string>(
    () => `${API}/repos/${REPO}/contents/README.md`,
    { parse: (raw: unknown) => decodeBase64(str(asRecord(raw)['content'])) },
  );

  /**
   * True when any resource failed with GitHub's rate-limit signature: a 403
   * whose `x-ratelimit-remaining` header is zero. An ordinary 403 or a 500 is
   * not rate limiting, and conflating them would produce a misleading message.
   */
  readonly isRateLimited: Signal<boolean> = computed(() =>
    [this.repo, this.commits, this.contributors, this.readme].some((res) => {
      const err = res.error();
      if (!err || typeof err !== 'object' || !('status' in err)) {
        return false;
      }
      const status = (err as { status: unknown }).status;
      if (status !== 403) {
        return false;
      }
      const headers = (err as { headers?: { get(name: string): string | null } }).headers;
      return headers?.get('x-ratelimit-remaining') === '0';
    }),
  );

  /** A single skill document, keyed on a signal so the resource refetches on change. */
  skillDoc(name: Signal<string | undefined>) {
    return httpResource<string>(
      () => {
        const value = name();
        return value
          ? `${API}/repos/${REPO}/contents/skills/${value}/SKILL.md`
          : undefined;
      },
      { parse: (raw: unknown) => decodeBase64(str(asRecord(raw)['content'])) },
    );
  }
}
```

- [ ] **Step 9: Wire HttpClient into the app config**

Modify `src/app/app.config.ts` — add `provideHttpClient()` to the providers array. The file already exists from `ng new`; add the import from `@angular/common/http` and the provider entry. Do not remove existing providers.

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx ng test --run`
Expected: PASS — 5 base64 tests, 5 `GithubApi` tests, plus everything from Tasks 2–3.

If `whenStable` proves to be the wrong way to drive `httpResource` in a test, consult the `testing-essentials` skill and adjust — the assertion is what matters, not the mechanism. Record the resolution in your report.

- [ ] **Step 11: Commit**

```bash
git add src/app/core/ src/app/app.config.ts
git commit -m "feat: GitHub API service with unauthenticated resources and rate-limit detection"
```

---

### Task 5: The token renderer — `ui/markdown/`

The design's principal claim: markdown rendered by composing components over a token tree, so no HTML string is ever built and NG014 has nothing to block.

**Files:**
- Create: `src/app/ui/markdown/md-view.ts`
- Create: `src/app/ui/markdown/md-code.ts`
- Create: `src/app/ui/markdown/md-table.ts`
- Create: `src/app/ui/markdown/md-view.spec.ts`

**Interfaces:**
- Consumes: `MdToken`, `tokenText` from Task 2.
- Produces:
  - `MdView` — selector `md-view`, input `tokens: MdToken[]`. Recursive.
  - `MdCode` — selector `md-code`, inputs `code: string`, `lang: string`.
  - `MdTable` — selector `md-table`, inputs `header: string[]`, `rows: string[][]`.

- [ ] **Step 1: Write the failing test**

Create `src/app/ui/markdown/md-view.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { lexMarkdown, type MdToken } from '../../core/parsing/markdown';
import { MdView } from './md-view';

@Component({
  imports: [MdView],
  template: `<md-view [tokens]="tokens()" />`,
})
class Host {
  readonly tokens = signal<MdToken[]>([]);
}

function render(markdown: string): HTMLElement {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.tokens.set(lexMarkdown(markdown));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MdView', () => {
  it('renders a heading at the right level', () => {
    const el = render('## Section title');
    expect(el.querySelector('h2')?.textContent).toContain('Section title');
  });

  it('renders paragraph text', () => {
    const el = render('Just a paragraph.');
    expect(el.textContent).toContain('Just a paragraph.');
  });

  it('renders a fenced code block with its language', () => {
    const el = render('```typescript\nconst a = 1;\n```');
    const code = el.querySelector('md-code');
    expect(code).not.toBeNull();
    expect(el.textContent).toContain('const a = 1;');
  });

  it('renders a table with header cells and body rows', () => {
    const el = render('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(el.querySelectorAll('th')).toHaveLength(2);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders nested list items recursively', () => {
    const el = render('- first\n- second');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders an unhandled token as visible text rather than dropping it', () => {
    // A definition list is not in the @switch, so it must hit the @default
    // branch and still show its text. Asserting on a token type the renderer
    // DOES handle would prove nothing.
    const el = render('Term\n: definition text here');
    expect(el.textContent).toContain('definition text here');
  });

  it('renders a horizontal rule', () => {
    const el = render('---');
    expect(el.querySelector('hr')).not.toBeNull();
  });

  it('never emits raw HTML into the DOM', () => {
    const el = render('Some `<script>alert(1)</script>` text');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>');
  });

  it('renders nothing for an empty token list', () => {
    const el = render('');
    expect(el.querySelector('h1')).toBeNull();
  });
});
```

The last-but-one test is the one that matters: a script tag inside markdown must appear as **text**, never as an element. That is the structural guarantee this whole approach buys.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./md-view` cannot be resolved.

- [ ] **Step 3: Write MdCode**

Create `src/app/ui/markdown/md-code.ts`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'md-code',
  template: `
    <pre><code [attr.data-lang]="lang()">{{ code() }}</code></pre>
  `,
  styles: `
    :host { display: block; }
    pre {
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      background: var(--surface-2);
      border-radius: 6px;
    }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.85rem; }
  `,
})
export class MdCode {
  readonly code = input.required<string>();
  readonly lang = input<string>('');
}
```

- [ ] **Step 4: Write MdTable**

Create `src/app/ui/markdown/md-table.ts`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'md-table',
  template: `
    <div class="scroll">
      <table>
        <thead>
          <tr>
            @for (cell of header(); track $index) {
              <th>{{ cell }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (cell of row; track $index) {
                <td>{{ cell }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 1rem; }
    .scroll { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); text-align: left; }
    th { font-weight: 600; }
  `,
})
export class MdTable {
  readonly header = input.required<string[]>();
  readonly rows = input.required<string[][]>();
}
```

- [ ] **Step 5: Write MdView**

Create `src/app/ui/markdown/md-view.ts`:

```typescript
import { Component, computed, input } from '@angular/core';
import { type MdToken, tokenText } from '../../core/parsing/markdown';
import { MdCode } from './md-code';
import { MdTable } from './md-table';

/** A table token's cells, normalised to plain strings. */
function cells(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((cell) => {
    if (typeof cell === 'string') {
      return cell;
    }
    if (cell && typeof cell === 'object' && 'text' in cell) {
      const text = (cell as { text: unknown }).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  });
}

/**
 * Renders a markdown token tree by composing components.
 *
 * `marked.parser()` is never called, so no HTML string exists at any point —
 * which is why NG014's ban on [innerHTML] costs nothing here. An unrecognised
 * token renders as its own plain text rather than disappearing, so an
 * unhandled construct degrades visibly.
 */
@Component({
  selector: 'md-view',
  imports: [MdCode, MdTable],
  template: `
    @for (token of tokens(); track $index) {
      @switch (token.type) {
        @case ('heading') {
          @switch (depth(token)) {
            @case (1) { <h1>{{ text(token) }}</h1> }
            @case (2) { <h2>{{ text(token) }}</h2> }
            @case (3) { <h3>{{ text(token) }}</h3> }
            @default { <h4>{{ text(token) }}</h4> }
          }
        }
        @case ('paragraph') {
          <p>{{ text(token) }}</p>
        }
        @case ('code') {
          <md-code [code]="text(token)" [lang]="lang(token)" />
        }
        @case ('table') {
          <md-table [header]="tableHeader(token)" [rows]="tableRows(token)" />
        }
        @case ('list') {
          <ul>
            @for (item of listItems(token); track $index) {
              <li>{{ item }}</li>
            }
          </ul>
        }
        @case ('blockquote') {
          <blockquote>{{ text(token) }}</blockquote>
        }
        @case ('space') {
          <!-- nothing to render -->
        }
        @case ('hr') {
          <hr />
        }
        @default {
          <p class="fallback">{{ text(token) }}</p>
        }
      }
    }
  `,
  styles: `
    :host { display: block; }
    h1, h2, h3, h4 { line-height: 1.25; margin: 1.5rem 0 0.5rem; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.3rem; }
    h3 { font-size: 1.1rem; }
    p { margin: 0 0 0.85rem; line-height: 1.6; }
    ul { margin: 0 0 0.85rem 1.25rem; }
    li { margin-bottom: 0.3rem; line-height: 1.55; }
    blockquote {
      margin: 0 0 0.85rem;
      padding-left: 0.9rem;
      border-left: 3px solid var(--border);
      color: var(--text-2);
    }
    .fallback { white-space: pre-wrap; }
  `,
})
export class MdView {
  readonly tokens = input.required<MdToken[]>();

  protected text(token: MdToken): string {
    return tokenText(token);
  }

  protected depth(token: MdToken): number {
    return 'depth' in token && typeof token.depth === 'number' ? token.depth : 4;
  }

  protected lang(token: MdToken): string {
    return 'lang' in token && typeof token.lang === 'string' ? token.lang : '';
  }

  protected tableHeader(token: MdToken): string[] {
    return 'header' in token ? cells((token as { header: unknown }).header) : [];
  }

  protected tableRows(token: MdToken): string[][] {
    if (!('rows' in token)) {
      return [];
    }
    const rows = (token as { rows: unknown }).rows;
    return Array.isArray(rows) ? rows.map((row) => cells(row)) : [];
  }

  protected listItems(token: MdToken): string[] {
    if (!('items' in token)) {
      return [];
    }
    const items = (token as { items: unknown }).items;
    return Array.isArray(items) ? items.map((item) => tokenText(item as MdToken)) : [];
  }
}
```

Note `protected` on the template-only members — the `project-structure` skill requires it, and it keeps the public surface to the single `tokens` input.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --run`
Expected: PASS — 9 tests in `md-view.spec.ts`.

- [ ] **Step 7: Record the NG014 verdict**

This task is the falsifiable claim in the spec. Append a section to `docs/plugin-findings.md`:

```markdown
## NG014 verdict — is a blocking `[innerHTML]` ban workable?

**Rendered:** the nine SKILL.md documents plus the README's rule tables via a
token tree, with no HTML string constructed at any point.

**Cost:** <n> components, <n> lines. <Which token types needed handling, and
which markdown constructs the renderer does not support.>

**Verdict:** <workable as a blocking rule / should be demoted to advisory> —
<why, concretely>.
```

Fill in the real numbers. If the renderer needed markdown constructs you could not support, name them — that is the evidence that decides the verdict.

- [ ] **Step 8: Commit**

```bash
git add src/app/ui/markdown/ docs/plugin-findings.md
git commit -m "feat: markdown token renderer composing components, no HTML strings"
```

---

### Task 6: Shared state components — `ui/state/`

Three distinct states, not one generic error. Built once here because all three routes need them.

**Files:**
- Create: `src/app/ui/state/loading-skeleton.ts`
- Create: `src/app/ui/state/error-state.ts`
- Create: `src/app/ui/state/error-state.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LoadingSkeleton` — selector `loading-skeleton`, input `rows: number` (default 3).
  - `ErrorState` — selector `error-state`, inputs `rateLimited: boolean`, `message: string`; output `retry: void`.

- [ ] **Step 1: Write the failing test**

Create `src/app/ui/state/error-state.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows a rate-limit explanation when rate limited', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', true);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('rate limit');
    expect(text).toContain('60 requests');
  });

  it('shows the actual failure message when not rate limited', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', false);
    fixture.componentRef.setInput('message', 'Network unreachable');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Network unreachable',
    );
  });

  it('emits retry when the retry button is pressed', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('rateLimited', false);
    fixture.componentRef.setInput('message', 'boom');
    let emitted = false;
    fixture.componentInstance.retry.subscribe(() => (emitted = true));
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    button?.click();
    expect(emitted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./error-state` cannot be resolved.

- [ ] **Step 3: Write the components**

Create `src/app/ui/state/loading-skeleton.ts`:

```typescript
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'loading-skeleton',
  template: `
    @for (row of placeholders(); track $index) {
      <div class="bar"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .bar {
      height: 1rem;
      margin-bottom: 0.6rem;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 37%, var(--surface-2) 63%);
      background-size: 400% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar { animation: none; }
    }
  `,
})
export class LoadingSkeleton {
  readonly rows = input<number>(3);
  protected readonly placeholders = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i),
  );
}
```

Create `src/app/ui/state/error-state.ts`:

```typescript
import { Component, input, output } from '@angular/core';

/**
 * Loading, rate-limited and failed are deliberately distinct. Collapsing them
 * into one generic error is what the data-loading skill warns against: a user
 * who is rate limited needs to know to wait, not to retry harder.
 */
@Component({
  selector: 'error-state',
  template: `
    <div class="box" [class.limited]="rateLimited()">
      @if (rateLimited()) {
        <h3>GitHub rate limit reached</h3>
        <p>
          This dashboard reads the GitHub API without a token, which allows
          60 requests per hour per IP. The limit resets within the hour.
        </p>
      } @else {
        <h3>Couldn't load this</h3>
        <p>{{ message() }}</p>
      }
      <button type="button" (click)="retry.emit()">Try again</button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .box {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-2);
    }
    .box.limited { border-color: var(--warn); }
    h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    p { margin: 0 0 0.9rem; color: var(--text-2); line-height: 1.55; }
    button {
      padding: 0.4rem 0.9rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      cursor: pointer;
      font: inherit;
    }
    button:hover { background: var(--surface-3); }
  `,
})
export class ErrorState {
  readonly rateLimited = input.required<boolean>();
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --run`
Expected: PASS — 3 tests in `error-state.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/state/
git commit -m "feat: distinct loading, rate-limited and failed state components"
```

---

### Task 7: `/rules` route — `features/rules/`

**Files:**
- Create: `src/app/features/rules/rules-page.ts`
- Create: `src/app/features/rules/rule-card.ts`
- Create: `src/app/features/rules/rule-filters.ts`
- Create: `src/app/features/rules/rules-page.spec.ts`

**Interfaces:**
- Consumes: `GithubApi` (Task 4), `parseRules`/`parseRulesOrThrow`/`Rule`/`RuleKind` (Task 3), `LoadingSkeleton`/`ErrorState` (Task 6).
- Produces: `RulesPage` — default export, lazily loaded by `app.routes.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

Create `src/app/features/rules/rules-page.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import RulesPage from './rules-page';

const README = `
| ID | Catches | Fix | Gate |
|---|---|---|---|
| BG002 | \`ng build --prod\` | Run \`ng build\`. | none |
| NG001 | \`standalone: true\` | Delete it. | v20+ |
| NG101 | Eager route | Use loadComponent. | none |
`;

describe('RulesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function renderWithReadme(markdown: string) {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/contents/README.md'))
      .flush({ content: btoa(markdown), encoding: 'base64' });
    fixture.detectChanges();
    return fixture;
  }

  it('shows a skeleton while the README is loading', () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('loading-skeleton'),
    ).not.toBeNull();
    http.expectOne((r) => r.url.includes('/contents/README.md')).flush({ content: '' });
  });

  it('renders one card per parsed rule', () => {
    const fixture = renderWithReadme(README);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card'),
    ).toHaveLength(3);
  });

  it('filters to blocking rules only', () => {
    const fixture = renderWithReadme(README);
    fixture.componentInstance.setKind('blocking');
    fixture.detectChanges();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('NG001');
  });

  it('filters by free-text query across id and trigger', () => {
    const fixture = renderWithReadme(README);
    fixture.componentInstance.setQuery('standalone');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('rule-card'),
    ).toHaveLength(1);
  });

  it('shows a parse error naming what it expected when the README has no tables', () => {
    const fixture = renderWithReadme('# No tables at all');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('four-column');
  });

  it('shows the rate-limit state when GitHub returns 403 with zero remaining', () => {
    const fixture = TestBed.createComponent(RulesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/contents/README.md')).flush('limited', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'x-ratelimit-remaining': '0' },
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('rate limit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — `./rules-page` cannot be resolved.

- [ ] **Step 3: Write RuleCard**

Create `src/app/features/rules/rule-card.ts`:

```typescript
import { Component, input } from '@angular/core';
import type { Rule } from '../../core/parsing/rules';

@Component({
  selector: 'rule-card',
  template: `
    <article>
      <header>
        <code class="id" [class.blocking]="rule().kind === 'blocking'"
              [class.advisory]="rule().kind === 'advisory'"
              [class.bash]="rule().kind === 'bash'">{{ rule().id }}</code>
        @if (rule().gate !== 'none') {
          <span class="gate">{{ rule().gate }}</span>
        }
      </header>
      <p class="trigger">{{ rule().trigger }}</p>
      <p class="fix">{{ rule().fix }}</p>
    </article>
  `,
  styles: `
    :host { display: block; }
    article {
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-1);
      height: 100%;
    }
    header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
    .id { font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 4px; }
    .id.blocking { background: var(--danger-bg); color: var(--danger); }
    .id.advisory { background: var(--warn-bg); color: var(--warn); }
    .id.bash { background: var(--surface-3); color: var(--text-2); }
    .gate { font-size: 0.75rem; color: var(--text-2); }
    .trigger { margin: 0 0 0.5rem; line-height: 1.5; }
    .fix { margin: 0; color: var(--text-2); font-size: 0.9rem; line-height: 1.5; }
  `,
})
export class RuleCard {
  readonly rule = input.required<Rule>();
}
```

- [ ] **Step 4: Write RuleFilters**

Create `src/app/features/rules/rule-filters.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import type { RuleKind } from '../../core/parsing/rules';

export type KindFilter = RuleKind | 'all';

@Component({
  selector: 'rule-filters',
  template: `
    <div class="bar">
      <input
        type="search"
        [value]="query()"
        placeholder="Filter rules…"
        aria-label="Filter rules"
        (input)="queryChange.emit(inputValue($event))"
      />
      <div class="kinds" role="group" aria-label="Rule kind">
        @for (option of options; track option.value) {
          <button
            type="button"
            [class.active]="kind() === option.value"
            (click)="kindChange.emit(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 1.25rem; }
    .bar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    input {
      flex: 1 1 14rem;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      font: inherit;
    }
    .kinds { display: flex; gap: 0.35rem; }
    button {
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-1);
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
    }
    button.active { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
  `,
})
export class RuleFilters {
  readonly query = input.required<string>();
  readonly kind = input.required<KindFilter>();
  readonly queryChange = output<string>();
  readonly kindChange = output<KindFilter>();

  protected readonly options: ReadonlyArray<{ value: KindFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'blocking', label: 'Blocking' },
    { value: 'advisory', label: 'Advisory' },
    { value: 'bash', label: 'Bash' },
  ];

  protected inputValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement ? target.value : '';
  }
}
```

- [ ] **Step 5: Write RulesPage**

Create `src/app/features/rules/rules-page.ts`:

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { GithubApi } from '../../core/github/github-api';
import { parseRules, RuleParseError, type Rule } from '../../core/parsing/rules';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { RuleCard } from './rule-card';
import { RuleFilters, type KindFilter } from './rule-filters';

@Component({
  selector: 'rules-page',
  imports: [RuleCard, RuleFilters, ErrorState, LoadingSkeleton],
  template: `
    <h1>Rules</h1>
    <p class="lede">
      Parsed live from the plugin's own README. Add a rule to angular-guide and it
      appears here without a redeploy.
    </p>

    @if (api.readme.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (failure(); as message) {
      <error-state
        [rateLimited]="api.isRateLimited()"
        [message]="message"
        (retry)="api.readme.reload()"
      />
    } @else {
      <rule-filters
        [query]="query()"
        [kind]="kind()"
        (queryChange)="setQuery($event)"
        (kindChange)="setKind($event)"
      />
      <p class="count">{{ visible().length }} of {{ rules().length }} rules</p>
      <div class="grid">
        @for (rule of visible(); track rule.id) {
          <rule-card [rule]="rule" />
        } @empty {
          <p class="empty">No rules match that filter.</p>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .lede { color: var(--text-2); max-width: 60ch; line-height: 1.6; }
    .count { color: var(--text-2); font-size: 0.85rem; margin: 0 0 0.75rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
      gap: 1rem;
    }
    .empty { color: var(--text-2); }
  `,
})
export default class RulesPage {
  protected readonly api = inject(GithubApi);

  private readonly queryState = signal('');
  private readonly kindState = signal<KindFilter>('all');

  protected readonly query = this.queryState.asReadonly();
  protected readonly kind = this.kindState.asReadonly();

  protected readonly rules = computed<Rule[]>(() => {
    const readme = this.api.readme.value();
    return readme ? parseRules(readme) : [];
  });

  /**
   * Transport failure and parse failure are different problems and get
   * different messages. A parse failure means the README changed shape, which
   * is a real risk when reading a document this repo does not control.
   */
  protected readonly failure = computed<string | null>(() => {
    const err = this.api.readme.error();
    if (err) {
      return err instanceof Error ? err.message : 'Request failed.';
    }
    const readme = this.api.readme.value();
    if (readme && parseRules(readme).length === 0) {
      return new RuleParseError(
        'a four-column markdown table (ID | catches | fix | gate) with rows whose first cell is a rule ID like NG001',
      ).message;
    }
    return null;
  });

  protected readonly visible = computed<Rule[]>(() => {
    const needle = this.queryState().trim().toLowerCase();
    const kind = this.kindState();
    return this.rules().filter((rule) => {
      const kindOk = kind === 'all' || rule.kind === kind;
      const textOk =
        needle === '' ||
        rule.id.toLowerCase().includes(needle) ||
        rule.trigger.toLowerCase().includes(needle) ||
        rule.fix.toLowerCase().includes(needle);
      return kindOk && textOk;
    });
  });

  setQuery(value: string): void {
    this.queryState.set(value);
  }

  setKind(value: KindFilter): void {
    this.kindState.set(value);
  }
}
```

`setQuery` and `setKind` are public because the spec's tests drive them directly; everything else is `protected`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --run`
Expected: PASS — 6 tests in `rules-page.spec.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/rules/
git commit -m "feat: rules route with live README parsing, filters and distinct failure states"
```

---

### Task 8: `/skills` and `/activity` routes

Two routes in one task: they share the same container shape already proven in Task 7, so a reviewer would accept or reject them together.

**Files:**
- Create: `src/app/features/skills/skills-page.ts`
- Create: `src/app/features/skills/skills-page.spec.ts`
- Create: `src/app/features/activity/activity-page.ts`
- Create: `src/app/features/activity/commit-list.ts`
- Create: `src/app/features/activity/contributor-card.ts`
- Create: `src/app/features/activity/activity-page.spec.ts`

**Interfaces:**
- Consumes: `GithubApi`, `lexMarkdown`, `MdView`, `LoadingSkeleton`, `ErrorState`.
- Produces: `SkillsPage` and `ActivityPage`, both default exports for lazy loading.

The nine skill names are a fixed list — they are the plugin's directory names, not data:

```typescript
const SKILLS = [
  'angular-essentials',
  'component-architecture',
  'data-loading',
  'performance-and-zoneless',
  'project-structure',
  'rxjs-interop',
  'signals-essentials',
  'state-management',
  'testing-essentials',
] as const;
```

- [ ] **Step 1: Write the failing tests**

Create `src/app/features/skills/skills-page.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import SkillsPage from './skills-page';

describe('SkillsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('lists all nine skills', () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-skill]'),
    ).toHaveLength(9);
  });

  it('renders the selected skill document through the token renderer', () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    fixture.componentInstance.select('signals-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('skills/signals-essentials/SKILL.md'))
      .flush({ content: btoa('## Decision table\n\nUse computed().'), encoding: 'base64' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('md-view')).not.toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('Decision table');
  });

  it('never renders raw HTML from a skill document', () => {
    const fixture = TestBed.createComponent(SkillsPage);
    fixture.detectChanges();
    fixture.componentInstance.select('angular-essentials');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('skills/angular-essentials/SKILL.md'))
      .flush({ content: btoa('Text with <img src=x onerror=alert(1)> inside'), encoding: 'base64' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });
});
```

Create `src/app/features/activity/activity-page.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import ActivityPage from './activity-page';

describe('ActivityPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function flushAll() {
    http
      .expectOne((r) => r.url.includes('/repos/j-morgan6/angular-guide') && !r.url.includes('/commits') && !r.url.includes('/contributors'))
      .flush({ name: 'angular-guide', stargazers_count: 4, forks_count: 1, open_issues_count: 0, pushed_at: '2026-09-07T00:00:00Z', description: 'd' });
    http.expectOne((r) => r.url.includes('/commits')).flush([
      {
        sha: 'abcdef1234',
        html_url: 'https://github.com/x',
        commit: { message: 'feat: thing\n\nbody', author: { name: 'Joseph Morgan', date: '2026-09-07T00:00:00Z' } },
        author: { avatar_url: 'https://avatars.example/1' },
      },
    ]);
    http.expectOne((r) => r.url.includes('/contributors')).flush([
      { login: 'j-morgan6', avatar_url: 'https://avatars.example/1', contributions: 41, html_url: 'https://github.com/j-morgan6' },
    ]);
  }

  it('renders commits with their short sha and subject line only', () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('abcdef1');
    expect(text).toContain('feat: thing');
    expect(text).not.toContain('body');
  });

  it('renders contributor cards', () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('contributor-card'),
    ).toHaveLength(1);
  });

  it('shows repo metadata', () => {
    const fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
    flushAll();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('4');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --run`
Expected: FAIL — neither page module resolves.

- [ ] **Step 3: Write SkillsPage**

Create `src/app/features/skills/skills-page.ts`:

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { GithubApi } from '../../core/github/github-api';
import { lexMarkdown } from '../../core/parsing/markdown';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { MdView } from '../../ui/markdown/md-view';

const SKILLS = [
  'angular-essentials',
  'component-architecture',
  'data-loading',
  'performance-and-zoneless',
  'project-structure',
  'rxjs-interop',
  'signals-essentials',
  'state-management',
  'testing-essentials',
] as const;

@Component({
  selector: 'skills-page',
  imports: [MdView, ErrorState, LoadingSkeleton],
  template: `
    <h1>Skills</h1>
    <p class="lede">
      The nine judgment-layer skills, rendered from their SKILL.md files by composing
      components over a markdown token tree — no HTML string is ever built.
    </p>

    <div class="layout">
      <nav aria-label="Skills">
        @for (name of skills; track name) {
          <button
            type="button"
            data-skill
            [class.active]="selected() === name"
            (click)="select(name)"
          >
            {{ name }}
          </button>
        }
      </nav>

      <section>
        @if (doc.isLoading()) {
          <loading-skeleton [rows]="8" />
        } @else if (doc.error(); as err) {
          <error-state
            [rateLimited]="api.isRateLimited()"
            [message]="messageOf(err)"
            (retry)="doc.reload()"
          />
        } @else if (tokens().length > 0) {
          <md-view [tokens]="tokens()" />
        } @else {
          <p class="hint">Pick a skill to read it.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .lede { color: var(--text-2); max-width: 60ch; line-height: 1.6; }
    .layout { display: grid; grid-template-columns: minmax(12rem, 16rem) 1fr; gap: 2rem; }
    @media (max-width: 48rem) { .layout { grid-template-columns: 1fr; } }
    nav { display: flex; flex-direction: column; gap: 0.25rem; }
    nav button {
      padding: 0.45rem 0.65rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
      text-align: left;
    }
    nav button:hover { background: var(--surface-2); }
    nav button.active { background: var(--surface-3); border-color: var(--border); font-weight: 600; }
    .hint { color: var(--text-2); }
  `,
})
export default class SkillsPage {
  protected readonly api = inject(GithubApi);
  protected readonly skills = SKILLS;

  private readonly selectedState = signal<string | undefined>(undefined);
  protected readonly selected = this.selectedState.asReadonly();

  protected readonly doc = this.api.skillDoc(this.selectedState.asReadonly());

  protected readonly tokens = computed(() => lexMarkdown(this.doc.value() ?? ''));

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }

  select(name: string): void {
    this.selectedState.set(name);
  }
}
```

- [ ] **Step 4: Write the activity components**

Create `src/app/features/activity/contributor-card.ts`:

```typescript
import { Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Contributor } from '../../core/github/github.types';

@Component({
  selector: 'contributor-card',
  imports: [NgOptimizedImage],
  template: `
    <a [href]="contributor().url" target="_blank" rel="noopener noreferrer">
      <img
        [ngSrc]="contributor().avatarUrl"
        width="48"
        height="48"
        [alt]="contributor().login"
      />
      <span class="login">{{ contributor().login }}</span>
      <span class="count">{{ contributor().contributions }} commits</span>
    </a>
  `,
  styles: `
    :host { display: block; }
    a {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      background: var(--surface-1);
    }
    a:hover { background: var(--surface-2); }
    img { border-radius: 50%; }
    .login { font-weight: 600; }
    .count { margin-left: auto; color: var(--text-2); font-size: 0.85rem; }
  `,
})
export class ContributorCard {
  readonly contributor = input.required<Contributor>();
}
```

`ngSrc` with explicit dimensions is used deliberately. GitHub avatars are a fixed 48px here, so `NgOptimizedImage` applies cleanly — but if NG104 fires on any `[src]` binding elsewhere in this build, record it: a bound URL with unknown dimensions cannot satisfy `ngSrc`, and that would make the rule wrong rather than you.

Create `src/app/features/activity/commit-list.ts`:

```typescript
import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Commit } from '../../core/github/github.types';

@Component({
  selector: 'commit-list',
  imports: [DatePipe],
  template: `
    <ol>
      @for (commit of commits(); track commit.sha) {
        <li>
          <a [href]="commit.url" target="_blank" rel="noopener noreferrer">
            <code>{{ commit.sha }}</code>
            <span class="message">{{ commit.message }}</span>
          </a>
          <span class="meta">{{ commit.authorName }} · {{ commit.date | date: 'mediumDate' }}</span>
        </li>
      } @empty {
        <li class="empty">No commits found.</li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    ol { list-style: none; margin: 0; padding: 0; }
    li { padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
    a { display: flex; gap: 0.6rem; text-decoration: none; color: inherit; align-items: baseline; }
    a:hover .message { text-decoration: underline; }
    code { color: var(--text-2); font-size: 0.8rem; }
    .message { flex: 1; }
    .meta { display: block; margin-top: 0.2rem; color: var(--text-2); font-size: 0.8rem; }
    .empty { color: var(--text-2); }
  `,
})
export class CommitList {
  readonly commits = input.required<Commit[]>();
}
```

- [ ] **Step 5: Write ActivityPage**

Create `src/app/features/activity/activity-page.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { GithubApi } from '../../core/github/github-api';
import { ErrorState } from '../../ui/state/error-state';
import { LoadingSkeleton } from '../../ui/state/loading-skeleton';
import { CommitList } from './commit-list';
import { ContributorCard } from './contributor-card';

@Component({
  selector: 'activity-page',
  imports: [CommitList, ContributorCard, ErrorState, LoadingSkeleton],
  template: `
    <h1>Activity</h1>

    @if (api.repo.value(); as repo) {
      <dl class="stats">
        <div><dt>Stars</dt><dd>{{ repo.stars }}</dd></div>
        <div><dt>Forks</dt><dd>{{ repo.forks }}</dd></div>
        <div><dt>Open issues</dt><dd>{{ repo.openIssues }}</dd></div>
      </dl>
    }

    <h2>Recent commits</h2>
    @if (api.commits.isLoading()) {
      <loading-skeleton [rows]="6" />
    } @else if (api.commits.error(); as err) {
      <error-state
        [rateLimited]="api.isRateLimited()"
        [message]="messageOf(err)"
        (retry)="api.commits.reload()"
      />
    } @else {
      <commit-list [commits]="api.commits.value() ?? []" />
    }

    @defer (on viewport) {
      <h2>Contributors</h2>
      @if (api.contributors.isLoading()) {
        <loading-skeleton [rows]="2" />
      } @else {
        <div class="contributors">
          @for (person of api.contributors.value() ?? []; track person.login) {
            <contributor-card [contributor]="person" />
          }
        </div>
      }
    } @placeholder {
      <div class="defer-placeholder"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .stats { display: flex; gap: 2rem; margin: 0 0 2rem; }
    .stats dt { color: var(--text-2); font-size: 0.8rem; }
    .stats dd { margin: 0.1rem 0 0; font-size: 1.4rem; font-weight: 600; }
    h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; }
    .contributors {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
      gap: 0.75rem;
    }
    .defer-placeholder { min-height: 6rem; }
  `,
})
export default class ActivityPage {
  protected readonly api = inject(GithubApi);

  protected messageOf(err: unknown): string {
    return err instanceof Error ? err.message : 'Request failed.';
  }
}
```

`@defer (on viewport)` on the contributors block is deliberate — it is the one place on this page where deferring is honest rather than decorative, since contributors sit below the fold.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --run`
Expected: PASS — 3 tests in `skills-page.spec.ts`, 3 in `activity-page.spec.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/skills/ src/app/features/activity/
git commit -m "feat: skills and activity routes"
```

---

### Task 9: Shell, routing, theme, deployment, and the findings verdict

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.ts` and its template
- Modify: `src/styles.css`
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Modify: `docs/plugin-findings.md`
- Create: `src/app/app.spec.ts` additions (routing assertions)

**Interfaces:**
- Consumes: `RulesPage`, `SkillsPage`, `ActivityPage` (default exports from Tasks 7–8).
- Produces: the deployed application.

- [ ] **Step 1: Write the failing routing test**

Replace the contents of `src/app/app.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

describe('App routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('redirects the empty path to /rules', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/rules');
  });

  it('lazily loads every feature route', () => {
    for (const route of routes) {
      if (route.path && route.path !== '**') {
        expect(route.loadComponent, `${route.path} must be lazy`).toBeDefined();
        expect((route as { component?: unknown }).component).toBeUndefined();
      }
    }
  });

  it('renders navigation links for all three routes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('nav a');
    expect(links).toHaveLength(3);
  });
});
```

Add `import { Router } from '@angular/router';` to the imports.

The second test is the one worth having: it asserts NG101's requirement structurally, so a future eager route fails the suite rather than only the hook.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --run`
Expected: FAIL — routes are still the `ng new` default.

- [ ] **Step 3: Write the routes**

Replace `src/app/app.routes.ts`:

```typescript
import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'rules' },
  {
    path: 'rules',
    title: 'Rules — angular-guide',
    loadComponent: () => import('./features/rules/rules-page'),
  },
  {
    path: 'skills',
    title: 'Skills — angular-guide',
    loadComponent: () => import('./features/skills/skills-page'),
  },
  {
    path: 'activity',
    title: 'Activity — angular-guide',
    loadComponent: () => import('./features/activity/activity-page'),
  },
  { path: '**', redirectTo: 'rules' },
];
```

Each feature module's default export is the component, so `loadComponent` needs no `.then()`.

- [ ] **Step 4: Write the shell**

Replace `src/app/app.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { GithubApi } from './core/github/github-api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="brand">
        <strong>angular-guide</strong>
        <span class="tag">showcase</span>
      </div>
      <nav>
        <a routerLink="/rules" routerLinkActive="active">Rules</a>
        <a routerLink="/skills" routerLinkActive="active">Skills</a>
        <a routerLink="/activity" routerLinkActive="active">Activity</a>
      </nav>
    </header>

    <main>
      <router-outlet />
    </main>

    <footer>
      <p>
        Built under the enforcement of the plugin it displays. Reads
        <a href="https://github.com/j-morgan6/angular-guide" target="_blank" rel="noopener noreferrer">
          j-morgan6/angular-guide
        </a>
        live via the GitHub API, unauthenticated.
      </p>
      @if (api.isRateLimited()) {
        <p class="limited">GitHub rate limit reached — data may be incomplete until it resets.</p>
      }
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: baseline; gap: 0.5rem; }
    .tag { color: var(--text-2); font-size: 0.8rem; }
    nav { display: flex; gap: 0.35rem; }
    nav a {
      padding: 0.35rem 0.7rem; border-radius: 6px;
      text-decoration: none; color: var(--text-2); font-size: 0.9rem;
    }
    nav a:hover { background: var(--surface-2); color: var(--text-1); }
    nav a.active { background: var(--surface-3); color: var(--text-1); font-weight: 600; }
    main { flex: 1; width: 100%; max-width: 72rem; margin: 0 auto; padding: 2rem 1.5rem; }
    footer {
      padding: 1.5rem; border-top: 1px solid var(--border);
      color: var(--text-2); font-size: 0.85rem; text-align: center;
    }
    footer a { color: inherit; }
    .limited { color: var(--warn); }
  `,
})
export class App {
  protected readonly api = inject(GithubApi);
}
```

- [ ] **Step 5: Write the theme**

Replace `src/styles.css`:

```css
:root {
  --surface-1: #ffffff;
  --surface-2: #f6f7f9;
  --surface-3: #eceef2;
  --border: #d8dce3;
  --text-1: #14181f;
  --text-2: #5c6673;
  --accent: #1a56db;
  --accent-fg: #ffffff;
  --danger: #b42318;
  --danger-bg: #fee4e2;
  --warn: #b54708;
  --warn-bg: #fef0c7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-1: #14181f;
    --surface-2: #1b2027;
    --surface-3: #242b34;
    --border: #333c48;
    --text-1: #e8ebef;
    --text-2: #9aa4b2;
    --accent: #5b8def;
    --accent-fg: #0b0e13;
    --danger: #f97066;
    --danger-bg: #3b1512;
    --warn: #f79009;
    --warn-bg: #3a2408;
  }
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--surface-1);
  color: var(--text-1);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

a:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Run tests and build**

```bash
npx ng test --run
npx ng build
```

Expected: all tests pass; the build succeeds and reports separate lazy chunks for the three routes. If the routes are not in separate chunks, `loadComponent` is not doing its job — fix it before continuing, because NG101's entire purpose is that split.

- [ ] **Step 7: Run the app and confirm it works against live data**

```bash
npx ng serve --port 4200 &
sleep 8
curl -s http://localhost:4200 | head -5
kill %1
```

Then open `http://localhost:4200` and check all three routes render real data from the live API. A dashboard that only passes unit tests has not been validated.

- [ ] **Step 8: Write the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx ng test --run
      - run: npx ng build --base-href /angular-guide-showcase/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/showcase/browser

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

The workflow runs the test suite before building. No secrets are referenced — the app is unauthenticated by design.

Confirm the artifact path matches the real build output:

```bash
npx ng build --base-href /angular-guide-showcase/ && ls dist/
```

If the directory is not `dist/showcase/browser`, correct the workflow to match.

- [ ] **Step 9: Write the README**

Create `README.md` covering: what this is and that it displays the plugin it was built under; a link to the deployed page and to `j-morgan6/angular-guide`; local development commands (`npm install`, `npx ng serve`, `npx ng test --run`); the note that all GitHub access is unauthenticated at 60 requests/hour and what the rate-limit state means; and a pointer to `docs/plugin-findings.md` as the validation record.

- [ ] **Step 10: Complete the findings log**

This is the deliverable. Add a synthesis section to `docs/plugin-findings.md`:

```markdown
---

## Summary

**Hook firings:** <n> total — <n> true positives, <n> false positives, <n> noise.

**Rules that fired at all:** <list>. The other <n> never triggered, which is
expected: rules like NG002 (`@NgModule`) and NG011 (`.mutate()`) only fire on
code no one writing modern Angular would produce.

**Rules that should have fired and did not:** <list, or "none observed">.

### Recommended for angular-guide v1.1

| Priority | Rule | Change | Evidence |
|---|---|---|---|
| … | … | … | findings entry above |

### Verdict on NG014

<From Task 5 — workable as blocking, or demote to advisory, with the concrete cost.>

### Was the plugin worth having?

<Honest assessment. Did it catch real mistakes, or mostly get in the way?
Both answers are useful; only a dishonest one is not.>
```

Fill every placeholder with real observations. If the plugin caused more friction than it prevented, say so plainly — that is a more valuable finding than a flattering one, and it is the reason this app was built.

- [ ] **Step 11: Final verification**

```bash
npx ng test --run
npx ng build --base-href /angular-guide-showcase/
git status --short
```

Expected: tests pass, build succeeds, working tree clean apart from intended files.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: app shell, lazy routing, theme, deployment, and findings synthesis"
```

---

## Notes for the executor

**When a hook blocks you, that is data.** Every block is a finding. Record it in
`docs/plugin-findings.md` before you change the code — the entry is worth more than the
few seconds it costs, and reconstructing it later is impossible because hook output is
ephemeral.

**Do not disable the plugin to get unstuck.** If a rule blocks something you are
convinced is correct and you cannot satisfy it, record the block, implement the nearest
compliant alternative, and note what you gave up. A workaround that is never written
down is a finding that never happened.

**Rules that never fire are not failures.** The plugin has 30 rules; this app will
trigger perhaps a third. Deliberately writing bad code to make the rest fire would
defeat the purpose — false positives only appear while writing code you believe is
correct.

**Angular v22 specifics to keep in mind:** OnPush is the default, so never set
`changeDetection`. Zoneless is the default, so state changes must flow through signals
or the view will not update. Vitest is the runner; `vi.fn()`, never `jasmine.createSpy`.
