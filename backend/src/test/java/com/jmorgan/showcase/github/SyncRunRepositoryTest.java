package com.jmorgan.showcase.github;

import com.jmorgan.showcase.PostgresTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SyncRunRepositoryTest extends PostgresTestBase {

    private final SyncRunRepository runs;

    @Autowired
    SyncRunRepositoryTest(SyncRunRepository runs) {
        this.runs = runs;
    }

    @Test
    void latestRunIsTheMostRecentlyStarted() {
        SyncRun older = SyncRun.started(Instant.parse("2026-09-01T00:00:00Z"));
        older.succeed(Instant.parse("2026-09-01T00:01:00Z"), 30);
        runs.save(older);

        SyncRun newer = SyncRun.started(Instant.parse("2026-09-10T00:00:00Z"));
        newer.fail(Instant.parse("2026-09-10T00:00:05Z"), "connection refused");
        runs.save(newer);

        Optional<SyncRun> latest = runs.findFirstByOrderByStartedAtDesc();

        assertThat(latest).isPresent();
        assertThat(latest.get().getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(latest.get().getError()).isEqualTo("connection refused");
    }
}
