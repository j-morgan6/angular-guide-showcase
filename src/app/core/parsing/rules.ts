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
