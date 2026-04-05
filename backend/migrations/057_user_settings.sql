-- Migration 057: Generic user settings table (DND, thread sounds, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  setting_id    BIGSERIAL     PRIMARY KEY,
  user_id       BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  setting_key   VARCHAR(80)   NOT NULL,
  setting_value JSONB         NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_unique
  ON user_settings (user_id, setting_key);
