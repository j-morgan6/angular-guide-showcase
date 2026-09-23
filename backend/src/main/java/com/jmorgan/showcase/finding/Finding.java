package com.jmorgan.showcase.finding;

import com.jmorgan.showcase.catalog.Rule;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "finding")
public class Finding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_id", nullable = false)
    private Rule rule;

    @Column(name = "file_path")
    private String filePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Verdict verdict;

    @Column(columnDefinition = "TEXT")
    private String why;

    @Column(columnDefinition = "TEXT")
    private String action;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected Finding() {
        // JPA
    }

    public Finding(Rule rule, String filePath, Verdict verdict, String why, String action, Instant recordedAt) {
        this.rule = rule;
        this.filePath = filePath;
        this.verdict = verdict;
        this.why = why;
        this.action = action;
        this.recordedAt = recordedAt;
    }

    public Long getId() {
        return id;
    }

    public Rule getRule() {
        return rule;
    }

    public String getFilePath() {
        return filePath;
    }

    public Verdict getVerdict() {
        return verdict;
    }

    public String getWhy() {
        return why;
    }

    public String getAction() {
        return action;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }
}
