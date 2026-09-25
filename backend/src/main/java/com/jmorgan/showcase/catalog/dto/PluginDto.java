package com.jmorgan.showcase.catalog.dto;

import java.time.Instant;

public record PluginDto(String slug, String name, String repoFullName, String description,
                        Instant syncedAt, int ruleCount) {
}
