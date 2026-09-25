package com.jmorgan.showcase.github;

import com.jmorgan.showcase.github.dto.SyncStatusDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService sync;
    private final GithubClientProperties properties;

    public SyncController(SyncService sync, GithubClientProperties properties) {
        this.sync = sync;
        this.properties = properties;
    }

    @GetMapping("/status")
    public SyncStatusDto status() {
        return sync.latestRun()
                .map(this::toDto)
                .orElseGet(() -> new SyncStatusDto("never", null, null, 0, null, true));
    }

    private SyncStatusDto toDto(SyncRun run) {
        boolean stale = run.getStatus() != SyncStatus.SUCCEEDED || isOverdue(run.getFinishedAt());
        return new SyncStatusDto(
                run.getStatus().name().toLowerCase(Locale.ROOT),
                run.getStartedAt(),
                run.getFinishedAt(),
                run.getRulesSynced(),
                run.getError(),
                stale);
    }

    private boolean isOverdue(Instant finishedAt) {
        if (finishedAt == null) {
            return true;
        }
        Duration interval = properties.syncInterval();
        return Duration.between(finishedAt, Instant.now()).compareTo(interval.multipliedBy(2)) > 0;
    }
}
