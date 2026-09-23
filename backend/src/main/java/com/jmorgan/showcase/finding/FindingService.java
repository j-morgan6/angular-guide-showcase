package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.catalog.Rule;
import com.jmorgan.showcase.finding.dto.FindingDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class FindingService {

    private final FindingRepository findings;

    public FindingService(FindingRepository findings) {
        this.findings = findings;
    }

    public List<FindingDto> findings(String ruleKey) {
        List<Finding> found = (ruleKey == null || ruleKey.isBlank())
                ? findings.findAllByOrderByRecordedAtDesc()
                : findings.findByRuleRuleKey(ruleKey);
        return found.stream().map(FindingService::toDto).toList();
    }

    private static FindingDto toDto(Finding finding) {
        Rule rule = finding.getRule();
        return new FindingDto(
                rule.getRuleId(),
                rule.getPlugin().getSlug(),
                finding.getFilePath(),
                finding.getVerdict().name().toLowerCase(Locale.ROOT),
                finding.getWhy(),
                finding.getAction(),
                finding.getRecordedAt());
    }
}
