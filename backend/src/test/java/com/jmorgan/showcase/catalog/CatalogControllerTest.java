package com.jmorgan.showcase.catalog;

import com.jmorgan.showcase.catalog.dto.PluginDto;
import com.jmorgan.showcase.catalog.dto.RuleDto;
import com.jmorgan.showcase.catalog.dto.SkillDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CatalogController.class)
class CatalogControllerTest {

    @MockitoBean
    private CatalogService catalog;

    private final MockMvc mvc;

    @Autowired
    CatalogControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void listsPlugins() throws Exception {
        given(catalog.plugins()).willReturn(List.of(
                new PluginDto("spring-boot-guide", "spring-boot-guide", "j-morgan6/spring-boot-guide",
                        "A plugin", Instant.parse("2026-09-20T00:00:00Z"), 39)));

        mvc.perform(get("/api/plugins"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("spring-boot-guide"))
                .andExpect(jsonPath("$[0].ruleCount").value(39));
    }

    @Test
    void listsRulesForAPlugin() throws Exception {
        given(catalog.rules(eq("spring-boot-guide"), any(), any())).willReturn(List.of(
                new RuleDto("SB005", "blocking", "eager fetch", "use LAZY", "none")));

        mvc.perform(get("/api/plugins/spring-boot-guide/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ruleId").value("SB005"))
                .andExpect(jsonPath("$[0].kind").value("blocking"));
    }

    @Test
    void returns404ForAnUnknownSkill() throws Exception {
        given(catalog.skill("spring-boot-guide", "nope")).willReturn(Optional.empty());

        mvc.perform(get("/api/plugins/spring-boot-guide/skills/nope"))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsASkillBody() throws Exception {
        given(catalog.skill("spring-boot-guide", "transactions"))
                .willReturn(Optional.of(new SkillDto("transactions", "# Transactions")));

        mvc.perform(get("/api/plugins/spring-boot-guide/skills/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("# Transactions"));
    }
}
