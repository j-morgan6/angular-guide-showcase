package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import com.jmorgan.showcase.catalog.dto.SkillSummaryDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final PluginRepository plugins;
    private final RuleRepository rules;
    private final SkillRepository skills;

    public CatalogService(PluginRepository plugins, RuleRepository rules, SkillRepository skills) {
        this.plugins = plugins;
        this.rules = rules;
        this.skills = skills;
    }

    public List<PluginDto> plugins() {
        return plugins.findAll().stream()
                .map(p -> new PluginDto(p.getSlug(), p.getName(), p.getRepoFullName(), p.getDescription(),
                        p.getSyncedAt(), (int) rules.countByPluginSlug(p.getSlug())))
                .toList();
    }

    /**
     * Filtering happens here rather than in the controller, and the free-text
     * match covers id, trigger and fix — the same three fields the front end's
     * filter searched before this moved server-side.
     */
    public List<RuleDto> rules(String slug, String kind, String query) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return rules.findByPluginSlugOrderByRuleId(slug).stream()
                .filter(r -> kind == null || kind.isBlank()
                        || r.getKind().name().equalsIgnoreCase(kind))
                .filter(r -> needle.isEmpty()
                        || r.getRuleId().toLowerCase(Locale.ROOT).contains(needle)
                        || r.getTriggerText().toLowerCase(Locale.ROOT).contains(needle)
                        || r.getFixText().toLowerCase(Locale.ROOT).contains(needle))
                .map(CatalogService::toDto)
                .toList();
    }

    public List<SkillSummaryDto> skills(String slug) {
        return skills.findByPluginSlugOrderByName(slug).stream()
                .map(s -> new SkillSummaryDto(s.getName()))
                .toList();
    }

    public Optional<SkillDto> skill(String slug, String name) {
        return skills.findBySkillKey(slug + ":" + name)
                .map(s -> new SkillDto(s.getName(), s.getBody()));
    }

    private static RuleDto toDto(Rule rule) {
        return new RuleDto(
                rule.getRuleId(),
                rule.getKind().name().toLowerCase(Locale.ROOT),
                rule.getTriggerText(),
                rule.getFixText(),
                rule.getGateText());
    }
}
