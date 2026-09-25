package com.jmorgan.showcase.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContributorRepository extends JpaRepository<Contributor, Long> {

    List<Contributor> findByPluginSlugOrderByContributionsDesc(String slug);

    Optional<Contributor> findByContributorKey(String contributorKey);
}
