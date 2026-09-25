package com.jmorgan.showcase.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    List<Skill> findByPluginSlugOrderByName(String slug);

    Optional<Skill> findBySkillKey(String skillKey);

    /**
     * Propagates upstream deletions: called after a sync upserts every skill
     * key it just saw under the plugin's {@code skills/} directory, so
     * anything for that plugin left out of {@code skillKeys} no longer
     * exists upstream and must stop being served.
     */
    void deleteByPluginSlugAndSkillKeyNotIn(String slug, Collection<String> skillKeys);
}
