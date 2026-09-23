package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.PostgresTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class CatalogRepositoryTest extends PostgresTestBase {

    private final PluginRepository plugins;
    private final RuleRepository rules;

    @Autowired
    CatalogRepositoryTest(PluginRepository plugins, RuleRepository rules) {
        this.plugins = plugins;
        this.rules = rules;
    }

    @Test
    void findsRulesForOnePluginOnly() {
        Plugin angular = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Plugin spring = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        rules.save(new Rule(angular, "NG014", RuleKind.BLOCKING, "[innerHTML]", "Compose components", "none"));
        rules.save(new Rule(spring, "SB005", RuleKind.BLOCKING, "FetchType.EAGER", "Use LAZY", "none"));

        List<Rule> found = rules.findByPluginSlugOrderByRuleId("spring-boot-guide");

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getRuleId()).isEqualTo("SB005");
    }

    @Test
    void ruleKeyDisambiguatesSharedBashIdsAcrossPlugins() {
        Plugin angular = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Plugin spring = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        Rule a = rules.save(new Rule(angular, "BG001", RuleKind.BASH, "force push", "use lease", "none"));
        Rule s = rules.save(new Rule(spring, "BG001", RuleKind.BASH, "force push", "use lease", "none"));

        assertThat(a.getRuleKey()).isEqualTo("angular-guide:BG001");
        assertThat(s.getRuleKey()).isEqualTo("spring-boot-guide:BG001");

        Optional<Rule> byKey = rules.findByRuleKey("spring-boot-guide:BG001");
        assertThat(byKey).isPresent();
        assertThat(byKey.get().getPlugin().getSlug()).isEqualTo("spring-boot-guide");
    }
}
