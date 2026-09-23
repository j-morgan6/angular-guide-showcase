package com.jmorgan.showcase.github;

import com.jmorgan.showcase.activity.Commit;
import com.jmorgan.showcase.activity.CommitRepository;
import com.jmorgan.showcase.activity.Contributor;
import com.jmorgan.showcase.activity.ContributorRepository;
import com.jmorgan.showcase.catalog.Plugin;
import com.jmorgan.showcase.catalog.PluginRepository;
import com.jmorgan.showcase.catalog.Rule;
import com.jmorgan.showcase.catalog.RuleRepository;
import com.jmorgan.showcase.catalog.Skill;
import com.jmorgan.showcase.catalog.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Carries the transactional body of a single repo's sync.
 *
 * Split out of {@link SyncService} so the {@code @Transactional} boundary is
 * real: {@code SyncService.syncAll()} used to call {@code syncRepo(...)} on
 * itself, and since Spring applies {@code @Transactional} through a proxy
 * that wraps the bean, that self-invocation bypassed the proxy entirely — no
 * transaction ever started. Calling into a separate bean goes through the
 * proxy, so the transaction is real. {@code SyncService.syncRepo} keeps its
 * name and stays the public entry point; it now just delegates here.
 */
@Service
public class RepoSyncer {

    private static final int COMMIT_PAGE_SIZE = 30;

    private final GithubClient github;
    private final PluginRepository plugins;
    private final RuleRepository rules;
    private final SkillRepository skills;
    private final CommitRepository commits;
    private final ContributorRepository contributors;

    public RepoSyncer(GithubClient github, PluginRepository plugins, RuleRepository rules,
                       SkillRepository skills, CommitRepository commits, ContributorRepository contributors) {
        this.github = github;
        this.plugins = plugins;
        this.rules = rules;
        this.skills = skills;
        this.commits = commits;
        this.contributors = contributors;
    }

    @Transactional
    public int sync(String repoFullName) {
        String slug = repoFullName.substring(repoFullName.indexOf('/') + 1);
        GithubRepo meta = github.fetchRepo(repoFullName);

        Plugin plugin = plugins.findBySlug(slug)
                .orElseGet(() -> plugins.save(new Plugin(slug, slug, repoFullName)));
        if (meta != null) {
            plugin.setDescription(meta.description());
        }
        plugin.setSyncedAt(Instant.now());
        plugins.save(plugin);

        int ruleCount = syncRules(plugin, repoFullName);
        syncSkills(plugin, repoFullName);
        syncCommits(plugin, repoFullName);
        syncContributors(plugin, repoFullName);
        return ruleCount;
    }

    /**
     * An empty README body is indistinguishable from "the repo genuinely has
     * zero rules" unless it is treated as a failure: {@link GithubClient}
     * swallows a 404/5xx from GitHub and returns {@code ""} either way. Left
     * unchecked, that empty body parses to zero rules, the sync "succeeds"
     * with {@code rulesSynced: 0}, and the dashboard renders a fresh-looking
     * "0 of 0 rules" instead of the stale-data marker the spec requires. This
     * exception propagates out of {@link #sync}; {@code SyncService.syncAll}
     * already catches {@code RuntimeException} and records the run as
     * {@code FAILED}, which is the whole point — a visibly stale dashboard
     * beats a silently empty one.
     */
    private int syncRules(Plugin plugin, String repoFullName) {
        String body = github.fetchFile(repoFullName, "README.md");
        if (body == null || body.isEmpty()) {
            throw new IllegalStateException(
                    "README.md for " + repoFullName + " came back empty — GitHub fetch failed "
                            + "or the file is genuinely missing; refusing to record a zero-rule sync as success");
        }
        List<ParsedRule> parsed = RuleTableParser.parse(body);
        Set<String> seenKeys = new HashSet<>();
        for (ParsedRule p : parsed) {
            String key = plugin.getSlug() + ":" + p.ruleId();
            seenKeys.add(key);
            Rule rule = rules.findByRuleKey(key)
                    .orElseGet(() -> new Rule(plugin, p.ruleId(), p.kind(), p.trigger(), p.fix(), p.gate()));
            rule.update(p.kind(), p.trigger(), p.fix(), p.gate());
            rules.save(rule);
        }
        // Upstream deletions propagate here: anything for this plugin that
        // was not just seen in the README table is gone from the source and
        // must not keep serving from /api/plugins/{slug}/rules.
        rules.deleteByPluginSlugAndRuleKeyNotIn(plugin.getSlug(), seenKeys);
        return parsed.size();
    }

    private void syncSkills(Plugin plugin, String repoFullName) {
        List<String> names = github.listSkillNames(repoFullName);
        Set<String> seenKeys = new HashSet<>();
        for (String name : names) {
            String key = plugin.getSlug() + ":" + name;
            seenKeys.add(key);
            String body = github.fetchFile(repoFullName, "skills/" + name + "/SKILL.md");
            if (body.isEmpty()) {
                continue;
            }
            Skill skill = skills.findBySkillKey(key)
                    .orElseGet(() -> new Skill(plugin, name, body));
            skill.updateBody(body);
            skills.save(skill);
        }
        // Same deletion propagation as syncRules, keyed off the directory
        // listing rather than which SKILL.md fetches happened to succeed, so
        // a single transient file-fetch failure doesn't delete a skill that
        // is still present upstream. Safe to trust an empty `names` here as
        // "genuinely zero skills" rather than "GitHub failed": unlike
        // fetchFile, GithubClient#listSkillNames no longer swallows a failed
        // request into List.of() — it throws, so a 503/rate-limit on this
        // call never reaches this line at all; it fails the whole sync
        // instead, the same way an empty README does.
        skills.deleteByPluginSlugAndSkillKeyNotIn(plugin.getSlug(), seenKeys);
    }

    private void syncCommits(Plugin plugin, String repoFullName) {
        for (GithubCommit c : github.fetchCommits(repoFullName, COMMIT_PAGE_SIZE)) {
            if (commits.findBySha(c.sha()).isPresent()) {
                continue;
            }
            String message = c.commit() == null ? "" : firstLine(c.commit().message());
            String authorName = c.commit() == null || c.commit().author() == null
                    ? "" : c.commit().author().name();
            Instant authoredAt = c.commit() == null || c.commit().author() == null
                    ? null : c.commit().author().date();
            String avatar = c.author() == null ? "" : c.author().avatarUrl();
            commits.save(new Commit(plugin, c.sha(), message, authorName, avatar, c.htmlUrl(), authoredAt));
        }
    }

    private void syncContributors(Plugin plugin, String repoFullName) {
        for (GithubContributor c : github.fetchContributors(repoFullName)) {
            Contributor existing = contributors.findByContributorKey(plugin.getSlug() + ":" + c.login())
                    .orElseGet(() -> new Contributor(plugin, c.login(), c.avatarUrl(), c.htmlUrl(), c.contributions()));
            existing.setContributions(c.contributions());
            contributors.save(existing);
        }
    }

    private static String firstLine(String message) {
        if (message == null) {
            return "";
        }
        int newline = message.indexOf('\n');
        return newline < 0 ? message : message.substring(0, newline);
    }
}
