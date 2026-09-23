package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.finding.dto.FindingDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/findings")
public class FindingController {

    private final FindingService findings;

    public FindingController(FindingService findings) {
        this.findings = findings;
    }

    @GetMapping
    public List<FindingDto> findings(@RequestParam(required = false) String ruleKey) {
        return findings.findings(ruleKey);
    }
}
