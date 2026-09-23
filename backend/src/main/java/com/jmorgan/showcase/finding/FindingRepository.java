package com.jmorgan.showcase.finding;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FindingRepository extends JpaRepository<Finding, Long> {

    List<Finding> findByRuleRuleKey(String ruleKey);

    List<Finding> findAllByOrderByRecordedAtDesc();
}
