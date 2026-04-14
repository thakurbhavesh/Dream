-- Migration 071: Call log table (audio/video call history across DMs)
CREATE TABLE IF NOT EXISTS call_logs (
  call_log_id     BIGSERIAL    PRIMARY KEY,
  organization_id BIGINT       NOT NULL,
  caller_id       BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  callee_id       BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  call_type       VARCHAR(16)  NOT NULL DEFAULT 'audio',     -- 'audio' | 'video'
  outcome         VARCHAR(24)  NOT NULL,                      -- 'missed' | 'declined' | 'no_answer' | 'offline' | 'answered'
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller_time
  ON call_logs (caller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_callee_time
  ON call_logs (callee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_org
  ON call_logs (organization_id, created_at DESC);
