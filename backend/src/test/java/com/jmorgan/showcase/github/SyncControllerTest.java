package com.jmorgan.showcase.github;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * No manual GithubClientProperties bean here: ShowcaseApplication's class-level
 * @EnableConfigurationProperties is still processed by @WebMvcTest (slice tests
 * filter component scanning, not annotations on the detected
 * @SpringBootConfiguration class itself), and application.yml's `github:` block
 * is on the test classpath, so the slice binds the real properties
 * (base-url, repos, sync-interval: PT6H) without any test-side stand-in.
 */
@WebMvcTest(SyncController.class)
class SyncControllerTest {

    @MockitoBean
    private SyncService sync;

    private final MockMvc mvc;

    @Autowired
    SyncControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void reportsNeverWhenNoSyncHasRun() throws Exception {
        given(sync.latestRun()).willReturn(Optional.empty());

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("never"))
                .andExpect(jsonPath("$.stale").value(true));
    }

    @Test
    void marksAFailedRunStale() throws Exception {
        SyncRun run = SyncRun.started(Instant.now().minusSeconds(60));
        run.fail(Instant.now(), "connection refused");
        given(sync.latestRun()).willReturn(Optional.of(run));

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("failed"))
                .andExpect(jsonPath("$.stale").value(true))
                .andExpect(jsonPath("$.error").value("connection refused"));
    }

    @Test
    void marksARecentSuccessFresh() throws Exception {
        SyncRun run = SyncRun.started(Instant.now().minusSeconds(60));
        run.succeed(Instant.now(), 39);
        given(sync.latestRun()).willReturn(Optional.of(run));

        mvc.perform(get("/api/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("succeeded"))
                .andExpect(jsonPath("$.stale").value(false))
                .andExpect(jsonPath("$.rulesSynced").value(39));
    }
}
