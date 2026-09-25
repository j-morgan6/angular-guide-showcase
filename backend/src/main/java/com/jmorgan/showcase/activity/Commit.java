package com.jmorgan.showcase.activity;

import com.jmorgan.showcase.catalog.Plugin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "commit_log")
public class Commit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(nullable = false, unique = true)
    private String sha;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "author_avatar_url")
    private String authorAvatarUrl;

    private String url;

    @Column(name = "authored_at")
    private Instant authoredAt;

    protected Commit() {
        // JPA
    }

    public Commit(Plugin plugin, String sha, String message, String authorName,
                  String authorAvatarUrl, String url, Instant authoredAt) {
        this.plugin = plugin;
        this.sha = sha;
        this.message = message;
        this.authorName = authorName;
        this.authorAvatarUrl = authorAvatarUrl;
        this.url = url;
        this.authoredAt = authoredAt;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getSha() {
        return sha;
    }

    public String getMessage() {
        return message;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getAuthorAvatarUrl() {
        return authorAvatarUrl;
    }

    public String getUrl() {
        return url;
    }

    public Instant getAuthoredAt() {
        return authoredAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Commit that)) {
            return false;
        }
        return Objects.equals(sha, that.sha);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sha);
    }
}
