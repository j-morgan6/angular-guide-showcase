package com.jmorgan.showcase.github;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

/**
 * Ingests the plugin repositories into the database.
 *
 * Upserts on the business key rather than deleting and reinserting: findings
 * reference rule ids, and churning them on every sync would orphan them.
 *
 * The actual per-repo write is delegated to {@link RepoSyncer}: {@code syncRepo}
 * used to carry {@code @Transactional} itself and be called from
 * {@code syncAll()} on {@code this}, which is a self-invocation that bypasses
 * the Spring AOP proxy and silently never opens a transaction. Delegating to a
 * separate bean makes the call cross-bean, so the proxy applies and the
 * transaction is real. {@code syncRepo} keeps its name and stays public here
 * because {@code SyncServiceTest} calls it directly and {@code SyncController}
 * injects {@code SyncService}.
 */
@Service
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);

    private final GithubClientProperties properties;
    private final SyncRunRepository runs;
    private final RepoSyncer repoSyncer;

    public SyncService(GithubClientProperties properties, SyncRunRepository runs, RepoSyncer repoSyncer) {
        this.properties = properties;
        this.runs = runs;
        this.repoSyncer = repoSyncer;
    }

    /**
     * Not @Transactional: each repo commits independently, so one failing repo
     * does not roll back another that already succeeded.
     */
    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "${github.sync-interval}")
    public void syncAll() {
        SyncRun run = runs.save(SyncRun.started(Instant.now()));
        int total = 0;
        try {
            for (String repo : properties.repos()) {
                total += syncRepo(repo);
            }
            run.succeed(Instant.now(), total);
            log.info("Sync succeeded: {} rules across {} repos", total, properties.repos().size());
        } catch (RuntimeException e) {
            run.fail(Instant.now(), e.getMessage());
            log.warn("Sync failed, keeping previous data", e);
        }
        runs.save(run);
    }

    public int syncRepo(String repoFullName) {
        return repoSyncer.sync(repoFullName);
    }

    public Optional<SyncRun> latestRun() {
        return runs.findFirstByOrderByStartedAtDesc();
    }
}
