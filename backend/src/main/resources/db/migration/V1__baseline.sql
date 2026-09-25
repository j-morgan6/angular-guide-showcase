CREATE TABLE plugin (
    id              BIGSERIAL PRIMARY KEY,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    repo_full_name  VARCHAR(200) NOT NULL,
    version         VARCHAR(50),
    description     TEXT,
    synced_at       TIMESTAMPTZ
);

CREATE TABLE rule (
    id          BIGSERIAL PRIMARY KEY,
    plugin_id   BIGINT NOT NULL REFERENCES plugin(id),
    rule_key    VARCHAR(150) NOT NULL UNIQUE,
    rule_id     VARCHAR(20) NOT NULL,
    kind        VARCHAR(20) NOT NULL,
    trigger_text TEXT NOT NULL,
    fix_text    TEXT NOT NULL,
    gate_text   TEXT NOT NULL
);
CREATE INDEX idx_rule_plugin ON rule(plugin_id);

CREATE TABLE skill (
    id         BIGSERIAL PRIMARY KEY,
    plugin_id  BIGINT NOT NULL REFERENCES plugin(id),
    skill_key  VARCHAR(250) NOT NULL UNIQUE,
    name       VARCHAR(200) NOT NULL,
    body       TEXT NOT NULL
);
CREATE INDEX idx_skill_plugin ON skill(plugin_id);

CREATE TABLE commit_log (
    id          BIGSERIAL PRIMARY KEY,
    plugin_id   BIGINT NOT NULL REFERENCES plugin(id),
    sha         VARCHAR(64) NOT NULL UNIQUE,
    message     TEXT NOT NULL,
    author_name VARCHAR(200),
    author_avatar_url VARCHAR(500),
    url         VARCHAR(500),
    authored_at TIMESTAMPTZ
);
CREATE INDEX idx_commit_plugin ON commit_log(plugin_id);

CREATE TABLE contributor (
    id              BIGSERIAL PRIMARY KEY,
    plugin_id       BIGINT NOT NULL REFERENCES plugin(id),
    contributor_key VARCHAR(250) NOT NULL UNIQUE,
    login           VARCHAR(200) NOT NULL,
    avatar_url      VARCHAR(500),
    url             VARCHAR(500),
    contributions   INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_contributor_plugin ON contributor(plugin_id);

CREATE TABLE finding (
    id           BIGSERIAL PRIMARY KEY,
    rule_id      BIGINT NOT NULL REFERENCES rule(id),
    file_path    VARCHAR(500),
    verdict      VARCHAR(30) NOT NULL,
    why          TEXT,
    action       TEXT,
    recorded_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_finding_rule ON finding(rule_id);

CREATE TABLE sync_run (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL,
    finished_at  TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL,
    rules_synced INT NOT NULL DEFAULT 0,
    error        TEXT
);
