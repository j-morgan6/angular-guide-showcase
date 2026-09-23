package com.jmorgan.showcase.github;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "sync_run")
public class SyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SyncStatus status;

    @Column(name = "rules_synced", nullable = false)
    private int rulesSynced;

    @Column(columnDefinition = "TEXT")
    private String error;

    protected SyncRun() {
        // JPA
    }

    private SyncRun(Instant startedAt) {
        this.startedAt = startedAt;
        this.status = SyncStatus.RUNNING;
    }

    public static SyncRun started(Instant at) {
        return new SyncRun(at);
    }

    public void succeed(Instant at, int rulesSynced) {
        this.finishedAt = at;
        this.status = SyncStatus.SUCCEEDED;
        this.rulesSynced = rulesSynced;
        this.error = null;
    }

    public void fail(Instant at, String error) {
        this.finishedAt = at;
        this.status = SyncStatus.FAILED;
        this.error = error;
    }

    public Long getId() {
        return id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public SyncStatus getStatus() {
        return status;
    }

    public int getRulesSynced() {
        return rulesSynced;
    }

    public String getError() {
        return error;
    }
}
