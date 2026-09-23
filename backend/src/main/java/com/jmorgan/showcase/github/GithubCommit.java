package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubCommit(
        String sha,
        Detail commit,
        Author author,
        @JsonProperty("html_url") String htmlUrl) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Detail(String message, Author author) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Author(String name, Instant date, @JsonProperty("avatar_url") String avatarUrl) {
    }
}
