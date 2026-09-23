package com.jmorgan.showcase.catalog.dto;

public record RuleDto(String ruleId, String kind, String trigger, String fix, String gate) {
}
