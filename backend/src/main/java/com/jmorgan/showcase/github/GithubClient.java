package com.jmorgan.showcase.github;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.DefaultUriBuilderFactory;
import org.springframework.web.util.UriUtils;

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
 * turn "owner/repo" into "owner%2Frepo" and 404 every request. Every
 * concatenated value is routed through {@link #sanitizePath(String)} first,
 * since path traversal segments and unencoded reserved characters would
 * otherwise reach the request URI unchecked.
 */
@Component
public class GithubClient {

    private static final Logger log = LoggerFactory.getLogger(GithubClient.class);

    private final RestClient restClient;

    public GithubClient(RestClient.Builder builder, GithubClientProperties properties) {
        // EncodingMode.VALUES_ONLY, not NONE or the TEMPLATE_AND_VALUES default:
        // VALUES_ONLY skips the template-string pre-encoding pass that double-
        // encoded our already-sanitizePath()-encoded segments (that pass fires
        // only under TEMPLATE_AND_VALUES/URI_COMPONENT), while still strictly
        // encoding any {var} template variable expanded later (e.g. {perPage}),
        // which NONE would silently stop protecting.
        DefaultUriBuilderFactory uriBuilderFactory = new DefaultUriBuilderFactory(properties.baseUrl());
        uriBuilderFactory.setEncodingMode(DefaultUriBuilderFactory.EncodingMode.VALUES_ONLY);

        RestClient.Builder configured = builder
                .uriBuilderFactory(uriBuilderFactory)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json");
        if (properties.token() != null && !properties.token().isBlank()) {
            configured = configured.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.token());
        }
        this.restClient = configured.build();
    }

    public GithubRepo fetchRepo(String repoFullName) {
        return restClient.get()
                .uri("/repos/" + sanitizePath(repoFullName))
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
                    .uri("/repos/" + sanitizePath(repoFullName) + "/contents/" + sanitizePath(path))
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
                .uri("/repos/" + sanitizePath(repoFullName) + "/commits?per_page={perPage}", perPage)
                .retrieve()
                .body(GithubCommit[].class);
        return commits == null ? List.of() : List.of(commits);
    }

    public List<GithubContributor> fetchContributors(String repoFullName) {
        GithubContributor[] contributors = restClient.get()
                .uri("/repos/" + sanitizePath(repoFullName) + "/contributors")
                .retrieve()
                .body(GithubContributor[].class);
        return contributors == null ? List.of() : List.of(contributors);
    }

    /**
     * The directory names under skills/ — each holds one SKILL.md.
     *
     * Unlike {@link #fetchFile}, this does not catch {@link RestClientResponseException}
     * and swallow it into {@code List.of()}: {@link com.jmorgan.showcase.github.RepoSyncer}
     * uses the result of this call to decide which skills to delete as
     * "no longer upstream", so a transient 503 or rate limit on this one
     * listing call must not be indistinguishable from "this repo genuinely
     * has zero skill directories" — that ambiguity is exactly what let a
     * passing-but-empty listing wipe every skill for a plugin on an
     * otherwise-healthy sync. Letting the exception propagate means the
     * caller's sync fails loudly (and RepoSyncer never reaches the delete
     * call) instead of "succeeding" with data loss.
     */
    public List<String> listSkillNames(String repoFullName) {
        GithubContent[] entries = restClient.get()
                .uri("/repos/" + sanitizePath(repoFullName) + "/contents/skills")
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
    }

    /**
     * Sanitizes a slash-separated value before it is concatenated into a
     * request URI. {@code repoFullName} is fixed today (two literals in
     * application.yml), but {@code path} will not stay that way once
     * SyncService starts building paths from directory names the GitHub API
     * returns — third-party-controlled content, not a literal.
     *
     * Splits on "/", rejects the whole value if any segment is empty, "."
     * or ".." (path traversal), then percent-encodes each remaining segment
     * on its own so a space, "#" or "?" inside a segment cannot redirect or
     * malform the request, while the "/" separators stay real path
     * separators rather than becoming "%2F".
     */
    private static String sanitizePath(String value) {
        String[] segments = value.split("/", -1);
        StringBuilder sanitized = new StringBuilder();
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) {
                throw new IllegalArgumentException("Invalid path segment in \"" + value + "\"");
            }
            if (!sanitized.isEmpty()) {
                sanitized.append('/');
            }
            sanitized.append(UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8));
        }
        return sanitized.toString();
    }
}
