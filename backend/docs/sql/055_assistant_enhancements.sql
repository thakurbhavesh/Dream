-- Migration: 055_assistant_enhancements.sql
-- Description: Add tables for assistant broadcasts, knowledge base, and rate limiting
-- Date: 2026-03-19

-- ============================================================
-- 1. Assistant Broadcasts
--    Organization-wide messages the assistant can deliver to users.
--    Supports priority levels and optional expiration.
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_broadcasts (
  broadcast_id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority VARCHAR(20) DEFAULT 'normal',  -- normal, high, urgent
  created_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_org_active
  ON assistant_broadcasts (organization_id)
  WHERE is_active = true;

-- ============================================================
-- 2. Assistant Knowledge Base
--    Stores custom knowledge entries per organization that the
--    assistant can reference when answering user queries.
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  knowledge_id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_org_active
  ON assistant_knowledge (organization_id)
  WHERE is_active = true;

-- ============================================================
-- 3. Assistant Rate Limits
--    Tracks per-user request counts within a sliding window
--    to enforce rate limiting on assistant usage.
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_rate_limits (
  rate_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INT DEFAULT 1,
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user
  ON assistant_rate_limits (user_id, organization_id);
