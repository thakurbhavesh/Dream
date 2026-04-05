-- Migration 058: Scheduled messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id BIGINT        NOT NULL,
  thread_id       VARCHAR(50)   NOT NULL,
  message         TEXT          NOT NULL,
  message_type    VARCHAR(20)   NOT NULL DEFAULT 'text',
  metadata        JSONB,
  send_at         TIMESTAMPTZ   NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',  -- pending / sent / cancelled
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON scheduled_messages (status, send_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user
  ON scheduled_messages (user_id, organization_id, status);
