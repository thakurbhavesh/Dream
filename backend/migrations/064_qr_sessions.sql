-- Migration 064: QR Code Login Sessions

CREATE TABLE IF NOT EXISTS qr_sessions (
  qr_id          TEXT PRIMARY KEY,
  qr_token       TEXT UNIQUE NOT NULL,
  organization_id BIGINT,
  user_id        BIGINT REFERENCES users(user_id),
  status         VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','linked','expired','used')),
  web_access_token TEXT,
  web_refresh_token TEXT,
  ip_address     VARCHAR(45),
  user_agent     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  linked_at      TIMESTAMPTZ,
  used_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qr_sessions_token ON qr_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_status ON qr_sessions(status, expires_at);
