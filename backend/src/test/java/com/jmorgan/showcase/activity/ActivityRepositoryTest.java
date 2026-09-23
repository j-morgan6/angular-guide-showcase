package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.PostgresTestBase;
import com.jmorgan.showcase.catalog.Plugin;
import com.jmorgan.showcase.catalog.PluginRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ActivityRepositoryTest extends PostgresTestBase {

    private final PluginRepository plugins;
    private final CommitRepository commits;
    private final ContributorRepository contributors;

    @Autowired
    ActivityRepositoryTest(PluginRepository plugins, CommitRepository commits, ContributorRepository contributors) {
        this.plugins = plugins;
        this.commits = commits;
        this.contributors = contributors;
    }

    @Test
    void returnsCommitsNewestFirst() {
        Plugin plugin = plugins.save(new Plugin("angular-guide", "angular-guide", "j-morgan6/angular-guide"));
        Instant older = Instant.parse("2026-09-01T00:00:00Z");
        Instant newer = Instant.parse("2026-09-10T00:00:00Z");

        commits.save(new Commit(plugin, "aaa1111", "older", "j", "", "", older));
        commits.save(new Commit(plugin, "bbb2222", "newer", "j", "", "", newer));

        List<Commit> found = commits.findByPluginSlugOrderByAuthoredAtDesc("angular-guide");

        assertThat(found).extracting(Commit::getMessage).containsExactly("newer", "older");
    }

    @Test
    void ranksContributorsByContributions() {
        Plugin plugin = plugins.save(new Plugin("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide"));

        contributors.save(new Contributor(plugin, "quiet", "", "", 3));
        contributors.save(new Contributor(plugin, "busy", "", "", 42));

        List<Contributor> found = contributors.findByPluginSlugOrderByContributionsDesc("spring-boot-guide");

        assertThat(found).extracting(Contributor::getLogin).containsExactly("busy", "quiet");
    }
}
