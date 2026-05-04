-- 077_fk_cascade_and_jsonb_gin.sql
--
-- 1. Tighten FK delete rules so user-deletion doesn't leave orphans / zombie tokens
--    - qr_sessions.user_id        → CASCADE  (security: drop tokens with the user)
--    - group_members.user_id      → CASCADE  (membership row is meaningless without user)
--    - group_messages.sender_id   → SET NULL (preserve message history, anonymize sender)
--
-- 2. Add GIN indexes on JSONB metadata columns to support metadata-based filtering.
--
-- All steps use IF EXISTS / IF NOT EXISTS so the migration is idempotent.

-- ─── qr_sessions.user_id ──────────────────────────────────────────────────────
ALTER TABLE qr_sessions DROP CONSTRAINT IF EXISTS qr_sessions_user_id_fkey;
ALTER TABLE qr_sessions
  ADD CONSTRAINT qr_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- ─── group_members.user_id ────────────────────────────────────────────────────
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS fk_gmem_user;
ALTER TABLE group_members
  ADD CONSTRAINT fk_gmem_user
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- ─── group_messages.sender_id ─────────────────────────────────────────────────
-- Column is currently NOT NULL; relax to allow SET NULL on user delete.
ALTER TABLE group_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE group_messages DROP CONSTRAINT IF EXISTS fk_gmsg_sender;
ALTER TABLE group_messages
  ADD CONSTRAINT fk_gmsg_sender
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- ─── JSONB GIN indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin
  ON messages USING gin (message_metadata);

CREATE INDEX IF NOT EXISTS idx_group_messages_metadata_gin
  ON group_messages USING gin (message_metadata);
