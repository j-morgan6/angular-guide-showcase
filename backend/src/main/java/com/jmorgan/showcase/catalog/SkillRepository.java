package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    List<Skill> findByPluginSlugOrderByName(String slug);

    Optional<Skill> findBySkillKey(String skillKey);
}
