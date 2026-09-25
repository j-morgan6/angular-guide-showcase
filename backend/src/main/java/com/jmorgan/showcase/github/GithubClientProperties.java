package com.jmorgan.showcase.github;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/**
 * Lives beside GithubClient rather than in a shared config package: the client
 * and its configuration change together.
 */
@ConfigurationProperties(prefix = "github")
public record GithubClientProperties(
        String token,
        String baseUrl,
        List<String> repos,
        Duration syncInterval) {
}
