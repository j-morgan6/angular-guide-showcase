package com.jmorgan.showcase.github;

import com.jmorgan.showcase.PostgresTestBase;
import com.jmorgan.showcase.catalog.RuleRepository;
import com.jmorgan.showcase.catalog.SkillRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@SpringBootTest
@ActiveProfiles("test")
class SyncServiceTest extends PostgresTestBase {

    private static final String REPO = "j-morgan6/spring-boot-guide";

    private static final String README = """
            | ID | Fires on | Fix | Gating |
            |---|---|---|---|
            | SB005 | eager fetch | use LAZY | none |
            | SB101 | self-invocation | split the bean | none |
            """;

    @MockitoBean
    private GithubClient github;

    private final SyncService sync;
    private final RuleRepository rules;
    private final SkillRepository skills;
    private final SyncRunRepository runs;

    @Autowired
    SyncServiceTest(SyncService sync, RuleRepository rules, SkillRepository skills, SyncRunRepository runs) {
        this.sync = sync;
        this.rules = rules;
        this.skills = skills;
        this.runs = runs;
    }

    private void stubHappyPath() {
        given(github.fetchRepo(REPO)).willReturn(new GithubRepo("spring-boot-guide", "A plugin", "2026-09-17T00:00:00Z"));
        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn(README);
        given(github.listSkillNames(REPO)).willReturn(List.of("transactions"));
        given(github.fetchFile(eq(REPO), eq("skills/transactions/SKILL.md"))).willReturn("# Transactions");
        given(github.fetchCommits(anyString(), anyInt())).willReturn(List.of());
        given(github.fetchContributors(anyString())).willReturn(List.of());
    }

    @Test
    void ingestsRulesAndSkills() {
        stubHappyPath();

        int synced = sync.syncRepo(REPO);

        assertThat(synced).isEqualTo(2);
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide")).hasSize(2);
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide")).hasSize(1);
    }

    @Test
    void isIdempotentAcrossRepeatedSyncs() {
        stubHappyPath();

        sync.syncRepo(REPO);
        Long idAfterFirst = rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getId();

        sync.syncRepo(REPO);

        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide")).hasSize(2);
        assertThat(rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getId())
                .as("an existing rule is updated in place, not deleted and reinserted")
                .isEqualTo(idAfterFirst);
    }

    @Test
    void updatesChangedRuleText() {
        stubHappyPath();
        sync.syncRepo(REPO);

        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn("""
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | SB005 | eager fetch anywhere | use LAZY always | none |
                | SB101 | self-invocation | split the bean | none |
                """);

        sync.syncRepo(REPO);

        assertThat(rules.findByRuleKey("spring-boot-guide:SB005").orElseThrow().getFixText())
                .isEqualTo("use LAZY always");
    }

    @Test
    void recordsAFailedRunAndLeavesPriorDataInPlace() {
        stubHappyPath();
        sync.syncRepo(REPO);

        given(github.fetchRepo(REPO)).willThrow(new IllegalStateException("connection refused"));

        sync.syncAll();

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();
        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(latest.get().getError()).contains("connection refused");
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide"))
                .as("a failed sync must not wipe good data")
                .hasSize(2);
    }
}
