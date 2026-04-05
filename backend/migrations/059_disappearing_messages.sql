-- Migration 059: Disappearing messages
CREATE TABLE IF NOT EXISTS disappearing_threads (
  id               BIGSERIAL     PRIMARY KEY,
  thread_id        VARCHAR(50)   NOT NULL,
  organization_id  BIGINT        NOT NULL,
  set_by           BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  duration_seconds BIGINT        NOT NULL,  -- 86400=24h, 604800=7d, 2592000=30d
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disappearing_threads_unique
  ON disappearing_threads (thread_id, organization_id);

-- Add expires_at columns to message tables
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_expires
  ON messages (expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_messages_expires
  ON group_messages (expires_at) WHERE expires_at IS NOT NULL;
