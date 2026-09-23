package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, Long> {

    List<Rule> findByPluginSlugOrderByRuleId(String slug);

    Optional<Rule> findByRuleKey(String ruleKey);

    long countByPluginSlug(String slug);

    /**
     * Propagates upstream deletions: called after a sync upserts every rule
     * key it just saw in the plugin's README table, so anything for that
     * plugin left out of {@code ruleKeys} no longer exists upstream and must
     * stop being served.
     */
    void deleteByPluginSlugAndRuleKeyNotIn(String slug, Collection<String> ruleKeys);
}
