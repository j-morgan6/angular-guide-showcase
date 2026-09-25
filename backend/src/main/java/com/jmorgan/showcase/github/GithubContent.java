package com.jmorgan.showcase.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GithubContent(String name, String path, String type, String content, String encoding) {
}
