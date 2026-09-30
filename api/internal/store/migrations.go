package store

import (
	"context"
	"fmt"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    full_name   TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'admin',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform (portal) user password reset. Separate from the end-user reset
-- flow. user_id is TEXT, not UUID, to match users.id. token_hash is the
-- SHA-256 hex of the raw token; the raw token is never stored.
CREATE TABLE IF NOT EXISTS platform_password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_password_reset_tokens_hash
    ON platform_password_reset_tokens(token_hash)
    WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS projects (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    description        TEXT NOT NULL DEFAULT '',
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jwt_signing_secret TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_api_keys (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    key_prefix   TEXT NOT NULL,
    key_hash     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    UNIQUE (project_id, type)
);

CREATE INDEX IF NOT EXISTS idx_apikeys_project ON project_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_prefix  ON project_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_projects_user   ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug   ON projects(slug);

CREATE TABLE IF NOT EXISTS stages (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    is_protected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stages_project ON stages(project_id);

CREATE TABLE IF NOT EXISTS instances (
    id                       TEXT PRIMARY KEY,
    stage_id                 TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    type                     TEXT NOT NULL,
    name                     TEXT NOT NULL,
    container_id             TEXT NOT NULL DEFAULT '',
    dsn                      TEXT NOT NULL DEFAULT '',
    memory_mb                INTEGER NOT NULL DEFAULT 512,
    backup_schedule          TEXT NOT NULL DEFAULT 'daily',
    retention_days           INTEGER NOT NULL DEFAULT 7,
    postgrest_container_id   TEXT NOT NULL DEFAULT '',
    authenticator_password   TEXT NOT NULL DEFAULT '',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (stage_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_instances_stage ON instances(stage_id);

CREATE TABLE IF NOT EXISTS buckets (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL UNIQUE,
    public      BOOLEAN NOT NULL DEFAULT FALSE,
    size_bytes  BIGINT NOT NULL DEFAULT 0,
    file_count  BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buckets_project ON buckets(project_id);
CREATE INDEX IF NOT EXISTS idx_buckets_name    ON buckets(name);

CREATE TABLE IF NOT EXISTS download_tokens (
    token      TEXT PRIMARY KEY,
    bucket     TEXT NOT NULL,
    key        TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
    id           TEXT PRIMARY KEY,
    instance_id  TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    project_id   TEXT NOT NULL DEFAULT '',
    type         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    size_bytes   BIGINT NOT NULL DEFAULT 0,
    minio_key    TEXT NOT NULL,
    error        TEXT NOT NULL DEFAULT '',
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_instance ON backups(instance_id);
CREATE INDEX IF NOT EXISTS idx_backups_status   ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_expires  ON backups(expires_at);

-- Mongo instances expose two connection strings (readWrite + readonly);
-- 'dsn' above holds the readWrite one, this holds the readonly one. Unused
-- (empty string) for postgres/redis instances.
ALTER TABLE instances ADD COLUMN IF NOT EXISTS readonly_dsn TEXT NOT NULL DEFAULT '';
`

func (s *Store) migrate(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}
