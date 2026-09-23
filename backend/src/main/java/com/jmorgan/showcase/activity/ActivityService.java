package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.activity.dto.CommitDto;
import com.jmorgan.showcase.activity.dto.ContributorDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ActivityService {

    private final CommitRepository commits;
    private final ContributorRepository contributors;

    public ActivityService(CommitRepository commits, ContributorRepository contributors) {
        this.commits = commits;
        this.contributors = contributors;
    }

    public List<CommitDto> commits(String slug) {
        return commits.findByPluginSlugOrderByAuthoredAtDesc(slug).stream()
                .map(c -> new CommitDto(c.getSha(), c.getMessage(), c.getAuthorName(),
                        c.getAuthorAvatarUrl(), c.getUrl(), c.getAuthoredAt()))
                .toList();
    }

    public List<ContributorDto> contributors(String slug) {
        return contributors.findByPluginSlugOrderByContributionsDesc(slug).stream()
                .map(c -> new ContributorDto(c.getLogin(), c.getAvatarUrl(), c.getUrl(), c.getContributions()))
                .toList();
    }
}
