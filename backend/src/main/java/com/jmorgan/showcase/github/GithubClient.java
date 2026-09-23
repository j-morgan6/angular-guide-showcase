package com.jmorgan.showcase.github;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Reads the plugin repositories from GitHub.
 *
 * RestClient, not RestTemplate: RestTemplate is deprecated at Boot 4 and
 * SB103 flags it from 3.2 onward.
 *
 * repoFullName ("owner/repo") is concatenated into the path rather than
 * passed as a {repo} URI template variable: RestClient's default encoding
 * mode percent-encodes "/" inside an expanded template variable, which would
 * turn "owner/repo" into "owner%2Frepo" and 404 every request.
 */
@Component
public class GithubClient {

    private static final Logger log = LoggerFactory.getLogger(GithubClient.class);

    private final RestClient restClient;

    public GithubClient(RestClient.Builder builder, GithubClientProperties properties) {
        RestClient.Builder configured = builder
                .baseUrl(properties.baseUrl())
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json");
        if (properties.token() != null && !properties.token().isBlank()) {
            configured = configured.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token());
        }
        this.restClient = configured.build();
    }

    public GithubRepo fetchRepo(String repoFullName) {
        return restClient.get()
                .uri("/repos/" + repoFullName)
                .retrieve()
                .body(GithubRepo.class);
    }

    /**
     * A file's decoded UTF-8 content, or "" when it does not exist.
     *
     * GitHub wraps base64 at 60 characters, so the newlines are stripped before
     * decoding; the bytes are then read as UTF-8 to keep em dashes and emoji
     * intact, which the plugin docs are full of.
     */
    public String fetchFile(String repoFullName, String path) {
        try {
            GithubContent content = restClient.get()
                    .uri("/repos/" + repoFullName + "/contents/" + path)
                    .retrieve()
                    .body(GithubContent.class);
            if (content == null || content.content() == null) {
                return "";
            }
            byte[] decoded = Base64.getMimeDecoder().decode(content.content());
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (RestClientResponseException e) {
            log.warn("Could not fetch {}/{}: {}", repoFullName, path, e.getStatusCode());
            return "";
        }
    }

    public List<GithubCommit> fetchCommits(String repoFullName, int perPage) {
        GithubCommit[] commits = restClient.get()
                .uri("/repos/" + repoFullName + "/commits?per_page={perPage}", perPage)
                .retrieve()
                .body(GithubCommit[].class);
        return commits == null ? List.of() : List.of(commits);
    }

    public List<GithubContributor> fetchContributors(String repoFullName) {
        GithubContributor[] contributors = restClient.get()
                .uri("/repos/" + repoFullName + "/contributors")
                .retrieve()
                .body(GithubContributor[].class);
        return contributors == null ? List.of() : List.of(contributors);
    }

    /** The directory names under skills/ — each holds one SKILL.md. */
    public List<String> listSkillNames(String repoFullName) {
        try {
            GithubContent[] entries = restClient.get()
                    .uri("/repos/" + repoFullName + "/contents/skills")
                    .retrieve()
                    .body(GithubContent[].class);
            if (entries == null) {
                return List.of();
            }
            List<String> names = new ArrayList<>();
            for (GithubContent entry : entries) {
                if ("dir".equals(entry.type())) {
                    names.add(entry.name());
                }
            }
            return names;
        } catch (RestClientResponseException e) {
            log.warn("Could not list skills for {}: {}", repoFullName, e.getStatusCode());
            return List.of();
        }
    }
}
