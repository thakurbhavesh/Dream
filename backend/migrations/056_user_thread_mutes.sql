-- Migration 056: Chat Mute per-thread per-user
CREATE TABLE IF NOT EXISTS user_thread_mutes (
  mute_id         BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id BIGINT        NOT NULL,
  thread_id       VARCHAR(50)   NOT NULL,
  mute_until      TIMESTAMPTZ,             -- NULL = muted forever
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_thread_mutes_unique
  ON user_thread_mutes (user_id, organization_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_user_thread_mutes_lookup
  ON user_thread_mutes (user_id, organization_id);
