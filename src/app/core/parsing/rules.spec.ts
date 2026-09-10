import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRules, parseRulesOrThrow, RuleParseError, type Rule, type RuleKind } from './rules';

/**
 * Resolve a workspace-relative path independently of the process cwd.
 * `import.meta.url` is not a file:// URL under this builder's esbuild bundle,
 * and no `.md` loader is configured, so neither of the usual approaches works —
 * anchor on angular.json the same way the Angular CLI locates the workspace.
 */
function fromWorkspaceRoot(relativePath: string): string {
  let dir = resolve(process.cwd());
  while (!existsSync(join(dir, 'angular.json'))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate angular.json above ${process.cwd()}`);
    }
    dir = parent;
  }
  return join(dir, relativePath);
}

const README = `
## Bash rules

| ID | Catches | Fix | Gate |
|---|---|---|---|
| BG002 | \`ng build --prod\` | Run \`ng build\`. | none |
| BG004 | \`ng test\` without a no-watch flag | Add \`--watch=false\`. | none |

## Blocking rules

| ID | Catches | Fix | Gate |
|---|---|---|---|
| NG001 | \`standalone\` property set to \`true\` in a decorator | Delete the property. | v20+ |
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

  // The above "never throws" assertion is satisfied unconditionally by this
  // implementation: marked pads every row to the header's column count, and
  // cellText() returns '' for any non-string/non-object cell, so no string
  // input can reach a bare property access. Verified directly against a
  // guard-stripped version of the row loop: it never throws either. That
  // means the assertion alone cannot tell a correct implementation from one
  // missing its `row.length < 4` guard — this test closes that gap by
  // checking observable output instead of absence-of-throw. Confirmed by
  // temporarily removing the guard: this table then produced a bogus
  // { id: 'NG999', trigger: 'not a real rule row', fix: '', gate: '' }.
  it('ignores a table row with fewer than four columns even when its first cell looks like a rule ID', () => {
    const shortTable = '| ID | Notes |\n|---|---|\n| NG999 | not a real rule row |\n';
    expect(parseRules(shortTable)).toEqual([]);
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

describe('parseRules against the real angular-guide README', () => {
  const real = readFileSync(
    fromWorkspaceRoot('src/app/core/parsing/__fixtures__/angular-guide-readme.md'),
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
