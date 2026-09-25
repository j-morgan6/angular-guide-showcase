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

import java.util.Objects;

@Entity
@Table(name = "contributor")
public class Contributor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(name = "contributor_key", nullable = false, unique = true)
    private String contributorKey;

    @Column(nullable = false)
    private String login;

    @Column(name = "avatar_url")
    private String avatarUrl;

    private String url;

    @Column(nullable = false)
    private int contributions;

    protected Contributor() {
        // JPA
    }

    public Contributor(Plugin plugin, String login, String avatarUrl, String url, int contributions) {
        this.plugin = plugin;
        this.login = login;
        this.contributorKey = plugin.getSlug() + ":" + login;
        this.avatarUrl = avatarUrl;
        this.url = url;
        this.contributions = contributions;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getContributorKey() {
        return contributorKey;
    }

    public String getLogin() {
        return login;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getUrl() {
        return url;
    }

    public int getContributions() {
        return contributions;
    }

    public void setContributions(int contributions) {
        this.contributions = contributions;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Contributor that)) {
            return false;
        }
        return Objects.equals(contributorKey, that.contributorKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(contributorKey);
    }
}
