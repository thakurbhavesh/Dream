-- Migration 069: Web Push subscriptions (service worker background push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  subscription_id BIGSERIAL    PRIMARY KEY,
  user_id         BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint        TEXT         NOT NULL,
  p256dh          TEXT         NOT NULL,
  auth            TEXT         NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);
