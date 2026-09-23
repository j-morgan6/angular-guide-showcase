package com.jmorgan.showcase.finding.dto;

import java.time.Instant;

public record FindingDto(String ruleId, String pluginSlug, String filePath, String verdict,
                         String why, String action, Instant recordedAt) {
}
