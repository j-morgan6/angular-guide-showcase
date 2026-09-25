package com.jmorgan.showcase.finding;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FindingRepository extends JpaRepository<Finding, Long> {

    /**
     * Both methods fetch `rule` and `rule.plugin` in the same query: {@link
     * FindingService#toDto} walks finding -> rule -> plugin for every row, and
     * without this the two lazy {@code @ManyToOne} associations turn a list
     * read into a 2N+1 (see docs/spring-plugin-findings.md, Task 10).
     */
    @EntityGraph(attributePaths = {"rule", "rule.plugin"})
    List<Finding> findByRuleRuleKey(String ruleKey);

    @EntityGraph(attributePaths = {"rule", "rule.plugin"})
    List<Finding> findAllByOrderByRecordedAtDesc();
}
