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
import java.util.List;

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

    private int syncRules(Plugin plugin, String repoFullName) {
        List<ParsedRule> parsed = RuleTableParser.parse(github.fetchFile(repoFullName, "README.md"));
        for (ParsedRule p : parsed) {
            String key = plugin.getSlug() + ":" + p.ruleId();
            Rule rule = rules.findByRuleKey(key)
                    .orElseGet(() -> new Rule(plugin, p.ruleId(), p.kind(), p.trigger(), p.fix(), p.gate()));
            rule.update(p.kind(), p.trigger(), p.fix(), p.gate());
            rules.save(rule);
        }
        return parsed.size();
    }

    private void syncSkills(Plugin plugin, String repoFullName) {
        for (String name : github.listSkillNames(repoFullName)) {
            String body = github.fetchFile(repoFullName, "skills/" + name + "/SKILL.md");
            if (body.isEmpty()) {
                continue;
            }
            Skill skill = skills.findBySkillKey(plugin.getSlug() + ":" + name)
                    .orElseGet(() -> new Skill(plugin, name, body));
            skill.updateBody(body);
            skills.save(skill);
        }
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
