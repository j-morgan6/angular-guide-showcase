package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ActivityController.class)
class ActivityControllerTest {

    @MockitoBean
    private ActivityService activity;

    private final MockMvc mvc;

    @Autowired
    ActivityControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void listsCommits() throws Exception {
        given(activity.commits("angular-guide")).willReturn(List.of(
                new CommitDto("abc1234", "feat: something", "j", "", "", Instant.parse("2026-09-10T00:00:00Z"))));

        mvc.perform(get("/api/plugins/angular-guide/activity/commits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sha").value("abc1234"))
                .andExpect(jsonPath("$[0].message").value("feat: something"));
    }

    @Test
    void listsContributors() throws Exception {
        given(activity.contributors("angular-guide")).willReturn(List.of(
                new ContributorDto("j-morgan6", "https://avatars/1", "https://github.com/j", 120)));

        mvc.perform(get("/api/plugins/angular-guide/activity/contributors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].login").value("j-morgan6"))
                .andExpect(jsonPath("$[0].contributions").value(120));
    }

    @Test
    void returnsAnEmptyArrayForAnUnknownPlugin() throws Exception {
        given(activity.commits("nope")).willReturn(List.of());

        mvc.perform(get("/api/plugins/nope/activity/commits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
