package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;

/**
 * One row of a plugin README's rule table. A plain record — no Spring, no JPA,
 * no annotations — so the parser is testable without a context.
 */
public record ParsedRule(String ruleId, RuleKind kind, String trigger, String fix, String gate) {
}
