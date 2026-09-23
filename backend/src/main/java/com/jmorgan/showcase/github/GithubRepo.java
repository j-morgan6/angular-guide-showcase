package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubRepo(String name, String description, @JsonProperty("pushed_at") String pushedAt) {
}
