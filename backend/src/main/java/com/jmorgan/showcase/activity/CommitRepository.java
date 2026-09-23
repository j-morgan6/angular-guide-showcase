package com.jmorgan.showcase.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommitRepository extends JpaRepository<Commit, Long> {

    List<Commit> findByPluginSlugOrderByAuthoredAtDesc(String slug);

    Optional<Commit> findBySha(String sha);
}
