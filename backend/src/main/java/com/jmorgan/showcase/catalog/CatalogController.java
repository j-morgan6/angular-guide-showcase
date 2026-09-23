package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import com.jmorgan.showcase.catalog.dto.SkillSummaryDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plugins")
public class CatalogController {

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public List<PluginDto> plugins() {
        return catalog.plugins();
    }

    @GetMapping("/{slug}/rules")
    public List<RuleDto> rules(@PathVariable String slug,
                               @RequestParam(required = false) String kind,
                               @RequestParam(required = false) String q) {
        return catalog.rules(slug, kind, q);
    }

    @GetMapping("/{slug}/skills")
    public List<SkillSummaryDto> skills(@PathVariable String slug) {
        return catalog.skills(slug);
    }

    @GetMapping("/{slug}/skills/{name}")
    public ResponseEntity<SkillDto> skill(@PathVariable String slug, @PathVariable String name) {
        return catalog.skill(slug, name)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
