package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plugins/{slug}/activity")
public class ActivityController {

    private final ActivityService activity;

    public ActivityController(ActivityService activity) {
        this.activity = activity;
    }

    @GetMapping("/commits")
    public List<CommitDto> commits(@PathVariable String slug) {
        return activity.commits(slug);
    }

    @GetMapping("/contributors")
    public List<ContributorDto> contributors(@PathVariable String slug) {
        return activity.contributors(slug);
    }
}
