package com.jmorgan.showcase;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} processing everywhere except the {@code test}
 * profile.
 *
 * Boot 4.1 has no {@code spring.task.scheduling.enabled} switch — verified
 * against the 4.1.0 jars: {@code spring.task.scheduling.*} only configures
 * the executor's pool size, thread-name-prefix and shutdown behaviour, not
 * whether {@code @Scheduled} methods run. {@code @EnableScheduling} is what
 * registers {@code ScheduledAnnotationBeanPostProcessor}, and that
 * post-processor is what actually triggers {@code SyncService.syncAll}, so
 * keeping the annotation off the test profile's context — by isolating it in
 * its own {@code @Profile("!test")}-gated {@code @Configuration} rather than
 * on {@link ShowcaseApplication} directly — is what stops the real
 * {@code GithubClient} in {@code ShowcaseApplicationTests} and
 * {@code SyncServiceTest} from firing a live sync against api.github.com
 * mid-suite.
 */
@Configuration
@Profile("!test")
@EnableScheduling
public class SchedulingConfig {
}
