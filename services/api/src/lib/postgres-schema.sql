-- Postgres equivalent of the SQLite schema in db.ts.
-- Applied idempotently by scripts/apply-postgres-schema.ts.

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  token            TEXT NOT NULL UNIQUE,
  wechat_openid    TEXT UNIQUE,
  wechat_union_id  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

CREATE TABLE IF NOT EXISTS query_tasks (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  tool              TEXT NOT NULL,
  input_kind        TEXT NOT NULL,
  raw_input         TEXT NOT NULL,
  -- Stored as the normalized string (e.g., "nike"), not a JSON object, so keep TEXT.
  normalized_input  TEXT NOT NULL,
  status            TEXT NOT NULL,
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_query_tasks_user_id ON query_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_query_tasks_status ON query_tasks(status);

CREATE TABLE IF NOT EXISTS reports (
  id                        TEXT PRIMARY KEY,
  task_id                   TEXT NOT NULL,
  level                     TEXT NOT NULL,
  summary                   TEXT NOT NULL,
  evidence_json             JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra_json                JSONB,
  unlocked                  BOOLEAN NOT NULL DEFAULT FALSE,
  data_source               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_fetched_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_task_id ON reports(task_id);

CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  email             TEXT,
  phone             TEXT,
  source_report_id  TEXT,
  source_task_id    TEXT,
  source_tool       TEXT,
  source_input      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitors (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_kind            TEXT NOT NULL,
  target_value           TEXT NOT NULL,
  notify_email           TEXT,
  notify_phone           TEXT,
  status                 TEXT NOT NULL,
  last_preview_level     TEXT,
  last_preview_summary   TEXT,
  last_checked_at        TIMESTAMPTZ,
  tick_interval_seconds  INTEGER
);
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS tick_interval_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_status ON monitors(status);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  monitor_id  TEXT REFERENCES monitors(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL,
  body        TEXT NOT NULL,
  level       TEXT,
  to_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_monitor_id ON messages(monitor_id);

CREATE TABLE IF NOT EXISTS advisors (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  specialty          TEXT,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_assigned_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS consultations (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
  name                   TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  note                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending',
  advisor                TEXT,
  advisor_id             TEXT REFERENCES advisors(id) ON DELETE SET NULL,
  target_ref_kind        TEXT,
  target_ref_value       TEXT,
  source_report_id       TEXT,
  source_query_task_id   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_advisor_id ON consultations(advisor_id);
