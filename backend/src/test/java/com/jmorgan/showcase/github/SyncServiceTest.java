package com.jmorgan.showcase.github;

import com.jmorgan.showcase.PostgresTestBase;
import com.jmorgan.showcase.catalog.RuleRepository;
import com.jmorgan.showcase.catalog.SkillRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.HttpServerErrorException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;

@SpringBootTest
@ActiveProfiles("test")
class SyncServiceTest extends PostgresTestBase {

    private static final String REPO = "j-morgan6/spring-boot-guide";

    /**
     * application.yml configures two repos, and syncAll() loops over both, so
     * any test that calls syncAll() (rather than syncRepo(REPO) directly)
     * must give this one a valid stub too — otherwise the unmocked calls for
     * it return Mockito's defaults (null for fetchFile's String), fix 5's
     * null/empty check treats that as a failure, and the loop fails on this
     * repo before it ever reaches REPO.
     */
    private static final String OTHER_REPO = "j-morgan6/angular-guide";

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

    private void stubOtherRepoSucceeds() {
        given(github.fetchRepo(OTHER_REPO)).willReturn(new GithubRepo("angular-guide", "The other plugin", "2026-09-17T00:00:00Z"));
        given(github.fetchFile(eq(OTHER_REPO), eq("README.md"))).willReturn("""
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | NG101 | eager route | use loadComponent | none |
                """);
        given(github.listSkillNames(OTHER_REPO)).willReturn(List.of());
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

        stubOtherRepoSucceeds();
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

    /**
     * GithubClient swallows a 404/5xx from GitHub's contents API and returns
     * "" either way, so an empty README is indistinguishable from "GitHub is
     * down" without treating it as a failure explicitly. Without that check,
     * this scenario would record a SUCCEEDED run with rulesSynced: 0 — a
     * dashboard that looks fresh and empty instead of stale and broken.
     */
    @Test
    void recordsFailedSyncWhenReadmeComesBackEmpty() {
        stubOtherRepoSucceeds();
        given(github.fetchRepo(REPO)).willReturn(new GithubRepo("spring-boot-guide", "A plugin", "2026-09-17T00:00:00Z"));
        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn("");
        given(github.listSkillNames(REPO)).willReturn(List.of());
        given(github.fetchCommits(anyString(), anyInt())).willReturn(List.of());
        given(github.fetchContributors(anyString())).willReturn(List.of());

        sync.syncAll();

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();
        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus())
                .as("an empty README must not be recorded as a successful zero-rule sync")
                .isEqualTo(SyncStatus.FAILED);
        assertThat(latest.get().getError()).contains(REPO);
    }

    @Test
    void removesRulesAndSkillsDeletedUpstream() {
        given(github.fetchRepo(REPO)).willReturn(new GithubRepo("spring-boot-guide", "A plugin", "2026-09-17T00:00:00Z"));
        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn("""
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | SB005 | eager fetch | use LAZY | none |
                | SB101 | self-invocation | split the bean | none |
                | SB102 | something else | fix it | none |
                """);
        given(github.listSkillNames(REPO)).willReturn(List.of("transactions", "testing"));
        given(github.fetchFile(eq(REPO), eq("skills/transactions/SKILL.md"))).willReturn("# Transactions");
        given(github.fetchFile(eq(REPO), eq("skills/testing/SKILL.md"))).willReturn("# Testing");
        given(github.fetchCommits(anyString(), anyInt())).willReturn(List.of());
        given(github.fetchContributors(anyString())).willReturn(List.of());

        int firstSync = sync.syncRepo(REPO);
        assertThat(firstSync).isEqualTo(3);
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide")).hasSize(3);
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide")).hasSize(2);

        given(github.fetchFile(eq(REPO), eq("README.md"))).willReturn("""
                | ID | Fires on | Fix | Gating |
                |---|---|---|---|
                | SB005 | eager fetch | use LAZY | none |
                | SB101 | self-invocation | split the bean | none |
                """);
        given(github.listSkillNames(REPO)).willReturn(List.of("transactions"));

        int secondSync = sync.syncRepo(REPO);

        assertThat(secondSync).isEqualTo(2);
        assertThat(rules.findByPluginSlugOrderByRuleId("spring-boot-guide"))
                .as("a rule removed upstream must be deleted, not just left un-updated")
                .extracting("ruleId")
                .containsExactlyInAnyOrder("SB005", "SB101");
        assertThat(rules.findByRuleKey("spring-boot-guide:SB102")).isEmpty();
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide"))
                .as("a skill removed upstream must be deleted too")
                .extracting("name")
                .containsExactly("transactions");
        assertThat(skills.findBySkillKey("spring-boot-guide:testing")).isEmpty();
    }

    /**
     * The regression this guards: GithubClient#listSkillNames used to catch
     * RestClientResponseException and return List.of(), identical to a
     * genuinely empty skills/ directory. RepoSyncer#syncSkills built its
     * "seen" set straight from that list with no way to tell the two apart,
     * so a transient 503 on the one listing call emptied seenKeys, the
     * unconditional deleteByPluginSlugAndSkillKeyNotIn wiped every stored
     * skill for the plugin, and because syncRules still succeeded, nothing
     * threw — the run recorded SUCCEEDED with the skills silently gone.
     * listSkillNames now lets that exception propagate instead of
     * swallowing it, so this must fail the run (same as an empty README)
     * and leave the previously-synced skill in place.
     */
    @Test
    void preservesExistingSkillsWhenTheSkillsListingFails() {
        stubHappyPath();
        sync.syncRepo(REPO);
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide")).hasSize(1);

        stubOtherRepoSucceeds();
        willThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE))
                .given(github).listSkillNames(REPO);

        sync.syncAll();

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();
        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus())
                .as("a failed skills listing must not be recorded as a clean success")
                .isEqualTo(SyncStatus.FAILED);
        assertThat(skills.findByPluginSlugOrderByName("spring-boot-guide"))
                .as("existing skills must survive a transient listing failure, not be wiped")
                .extracting("name")
                .containsExactly("transactions");
    }
}
