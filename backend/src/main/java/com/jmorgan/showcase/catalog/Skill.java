package com.jmorgan.showcase.catalog;

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
@Table(name = "skill")
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    @Column(name = "skill_key", nullable = false, unique = true)
    private String skillKey;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    protected Skill() {
        // JPA
    }

    public Skill(Plugin plugin, String name, String body) {
        this.plugin = plugin;
        this.name = name;
        this.skillKey = plugin.getSlug() + ":" + name;
        this.body = body;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getSkillKey() {
        return skillKey;
    }

    public String getName() {
        return name;
    }

    public String getBody() {
        return body;
    }

    public void updateBody(String body) {
        this.body = body;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Skill that)) {
            return false;
        }
        return Objects.equals(skillKey, that.skillKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(skillKey);
    }
}
