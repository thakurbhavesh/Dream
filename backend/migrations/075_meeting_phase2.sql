-- Migration 075: Meeting Phase 2 — co-host, recurring, reminders, attendance

-- 1. Recurring meetings (simple rule: 'none' | 'daily' | 'weekly' | 'monthly')
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(16) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_meeting_id BIGINT REFERENCES meetings(id) ON DELETE CASCADE;

-- 2. Reminder bookkeeping (so cron can mark what's been sent)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meetings_reminder_due
  ON meetings (scheduled_at)
  WHERE meeting_type = 'scheduled'
    AND status = 'waiting'
    AND reminder_sent_at IS NULL;

-- 3. meeting_participants: allow role='co-host'. role column already exists and is TEXT/VARCHAR.
-- Add CHECK only if not present (idempotent style)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_participants' AND column_name = 'role'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN role VARCHAR(32) DEFAULT 'participant';
  END IF;
END $$;

-- 4. Attendance session ranges (joined_at / left_at per session, not just latest)
CREATE TABLE IF NOT EXISTS meeting_attendance_sessions (
  session_id      BIGSERIAL PRIMARY KEY,
  meeting_id      BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  display_name    VARCHAR(255),
  socket_id       VARCHAR(64),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mas_meeting
  ON meeting_attendance_sessions (meeting_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_mas_open
  ON meeting_attendance_sessions (meeting_id, socket_id)
  WHERE left_at IS NULL;
