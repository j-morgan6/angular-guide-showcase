package com.jmorgan.showcase.activity.dto;

import java.time.Instant;

public record CommitDto(String sha, String message, String authorName, String authorAvatarUrl,
                        String url, Instant authoredAt) {
}
