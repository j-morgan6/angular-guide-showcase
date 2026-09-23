package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, Long> {

    List<Rule> findByPluginSlugOrderByRuleId(String slug);

    Optional<Rule> findByRuleKey(String ruleKey);

    long countByPluginSlug(String slug);
}
