-- Migration 072: Per-user pinned chat threads
CREATE TABLE IF NOT EXISTS user_thread_pins (
  pin_id          BIGSERIAL    PRIMARY KEY,
  user_id         BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id BIGINT       NOT NULL,
  thread_id       VARCHAR(50)  NOT NULL,
  pinned_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_thread_pins_unique
  ON user_thread_pins (user_id, organization_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_user_thread_pins_lookup
  ON user_thread_pins (user_id, organization_id);
