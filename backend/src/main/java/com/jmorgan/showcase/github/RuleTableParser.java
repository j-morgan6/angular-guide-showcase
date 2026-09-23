package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the rule tables out of a plugin README.
 *
 * Every rule table is four columns — ID, what it catches, the fix, the version
 * gate — so a row is a rule exactly when its first cell is a rule ID. Rows that
 * are not (prose tables elsewhere in the README) are skipped rather than treated
 * as errors, because a README legitimately contains other tables.
 *
 * Deliberately line-based rather than a full markdown parse: the only structure
 * that matters is the pipe-delimited row, and a full lexer would be a dependency
 * and a failure mode for no gain.
 *
 * Never throws. Returns an empty list when nothing matches.
 */
public final class RuleTableParser {

    private static final Pattern RULE_ID = Pattern.compile("^(BG|NG|SB)(\\d{3})$");

    /** A pipe that is not escaped and not inside a backtick span. */
    private static final String ESCAPED_PIPE = "\u0001";  // cannot occur in markdown

    private RuleTableParser() {
    }

    public static List<ParsedRule> parse(String markdown) {
        List<ParsedRule> rules = new ArrayList<>();
        if (markdown == null || markdown.isBlank()) {
            return rules;
        }

        for (String line : markdown.split("\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|")) {
                continue;
            }
            List<String> cells = splitRow(trimmed);
            if (cells.size() != 4) {
                continue;
            }
            Matcher match = RULE_ID.matcher(cells.getFirst());
            if (!match.matches()) {
                continue;
            }
            rules.add(new ParsedRule(
                    cells.get(0),
                    classify(match.group(1), Integer.parseInt(match.group(2))),
                    cells.get(1),
                    cells.get(2),
                    cells.get(3)));
        }

        return rules;
    }

    private static RuleKind classify(String prefix, int number) {
        if ("BG".equals(prefix)) {
            return RuleKind.BASH;
        }
        return number >= 100 ? RuleKind.ADVISORY : RuleKind.BLOCKING;
    }

    /**
     * Split a table row on unescaped pipes that are not inside inline code.
     * Rule text is full of `a | b` inside backticks, and splitting naively on
     * "|" would shred those cells.
     */
    private static List<String> splitRow(String row) {
        String protectedRow = row.replace("\\|", ESCAPED_PIPE);

        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inCode = false;

        for (int i = 0; i < protectedRow.length(); i++) {
            char c = protectedRow.charAt(i);
            if (c == '`') {
                inCode = !inCode;
                current.append(c);
            } else if (c == '|' && !inCode) {
                cells.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        cells.add(current.toString());

        List<String> cleaned = new ArrayList<>();
        for (String cell : cells) {
            String value = cell.replace(ESCAPED_PIPE, "|").trim();
            if (!value.isEmpty()) {
                cleaned.add(value);
            }
        }
        return cleaned;
    }
}
