package com.jmorgan.showcase.github;

import com.jmorgan.showcase.catalog.RuleKind;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleTableParserTest {

    private static String fixture(String name) {
        try (InputStream in = RuleTableParserTest.class.getResourceAsStream("/fixtures/" + name)) {
            if (in == null) {
                throw new IllegalStateException("fixture not found: " + name);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    void classifiesByPrefixAndNumber() {
        String md = """
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | BG001 | a force push | use lease | none |
                | SB005 | eager fetch | use LAZY | none |
                | SB101 | self-invocation | split the bean | none |
                """;

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).extracting(ParsedRule::ruleId).containsExactly("BG001", "SB005", "SB101");
        assertThat(rules).extracting(ParsedRule::kind)
                .containsExactly(RuleKind.BASH, RuleKind.BLOCKING, RuleKind.ADVISORY);
    }

    @Test
    void skipsRowsWhoseFirstCellIsNotARuleId() {
        String md = """
                | Endpoint | For |
                |---|---|
                | GET /repos | metadata |
                | SB005 | eager fetch | use LAZY | none |
                """;

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).extracting(ParsedRule::ruleId).containsExactly("SB005");
    }

    @Test
    void preservesPipesInsideInlineCode() {
        String md = "| SB009 | `@RequestMapping(method = …)` | Use `@GetMapping`/`@PostMapping` | none |";

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst().fix()).isEqualTo("Use `@GetMapping`/`@PostMapping`");
    }

    @Test
    void handlesEscapedPipesInCellText() {
        String md = "| SB008 | a `+` concat with \\| in it | use parameters | none |";

        List<ParsedRule> rules = RuleTableParser.parse(md);

        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst().trigger()).contains("|");
    }

    @Test
    void returnsEmptyForMarkdownWithNoRuleTables() {
        assertThat(RuleTableParser.parse("# Just a heading\n\nSome prose.")).isEmpty();
    }

    @Test
    void returnsEmptyForNullAndBlankInput() {
        assertThat(RuleTableParser.parse(null)).isEmpty();
        assertThat(RuleTableParser.parse("")).isEmpty();
        assertThat(RuleTableParser.parse("   ")).isEmpty();
    }

    @Test
    void parsesTheRealAngularGuideReadme() {
        List<ParsedRule> rules = RuleTableParser.parse(fixture("angular-guide-readme.md"));

        assertThat(rules).isNotEmpty();
        assertThat(rules).extracting(ParsedRule::ruleId).contains("NG014");
        assertThat(rules).allSatisfy(rule -> {
            assertThat(rule.ruleId()).isNotBlank();
            assertThat(rule.trigger()).isNotBlank();
            assertThat(rule.fix()).isNotBlank();
        });
    }

    @Test
    void isIdempotentAcrossRepeatedParses() {
        String md = fixture("angular-guide-readme.md");

        assertThat(RuleTableParser.parse(md)).isEqualTo(RuleTableParser.parse(md));
    }
}
