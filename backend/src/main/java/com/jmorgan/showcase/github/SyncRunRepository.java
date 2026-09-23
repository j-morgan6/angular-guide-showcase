package com.jmorgan.showcase.github;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SyncRunRepository extends JpaRepository<SyncRun, Long> {

    Optional<SyncRun> findFirstByOrderByStartedAtDesc();
}
