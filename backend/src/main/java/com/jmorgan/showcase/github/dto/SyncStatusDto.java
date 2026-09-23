package com.jmorgan.showcase.github.dto;

import java.time.Instant;

/**
 * `stale` is what the front end's degraded state renders: the last run either
 * failed or finished longer ago than one sync interval.
 */
public record SyncStatusDto(String status, Instant startedAt, Instant finishedAt,
                            int rulesSynced, String error, boolean stale) {
}
