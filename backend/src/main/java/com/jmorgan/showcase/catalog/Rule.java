package com.jmorgan.showcase.catalog;

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

import java.util.Objects;

@Entity
@Table(name = "rule")
public class Rule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plugin_id", nullable = false)
    private Plugin plugin;

    /** "{pluginSlug}:{ruleId}" — both plugins ship BG001-BG006, so ruleId alone collides. */
    @Column(name = "rule_key", nullable = false, unique = true)
    private String ruleKey;

    @Column(name = "rule_id", nullable = false)
    private String ruleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RuleKind kind;

    @Column(name = "trigger_text", nullable = false, columnDefinition = "TEXT")
    private String triggerText;

    @Column(name = "fix_text", nullable = false, columnDefinition = "TEXT")
    private String fixText;

    @Column(name = "gate_text", nullable = false, columnDefinition = "TEXT")
    private String gateText;

    protected Rule() {
        // JPA
    }

    public Rule(Plugin plugin, String ruleId, RuleKind kind, String trigger, String fix, String gate) {
        this.plugin = plugin;
        this.ruleId = ruleId;
        this.ruleKey = plugin.getSlug() + ":" + ruleId;
        this.kind = kind;
        this.triggerText = trigger;
        this.fixText = fix;
        this.gateText = gate;
    }

    public Long getId() {
        return id;
    }

    public Plugin getPlugin() {
        return plugin;
    }

    public String getRuleKey() {
        return ruleKey;
    }

    public String getRuleId() {
        return ruleId;
    }

    public RuleKind getKind() {
        return kind;
    }

    public String getTriggerText() {
        return triggerText;
    }

    public String getFixText() {
        return fixText;
    }

    public String getGateText() {
        return gateText;
    }

    public void update(RuleKind kind, String trigger, String fix, String gate) {
        this.kind = kind;
        this.triggerText = trigger;
        this.fixText = fix;
        this.gateText = gate;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Rule that)) {
            return false;
        }
        return Objects.equals(ruleKey, that.ruleKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ruleKey);
    }
}
