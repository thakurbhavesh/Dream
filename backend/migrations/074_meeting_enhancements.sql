-- Migration 074: Meeting enhancements (passcode, reminders)
-- Adds optional passcode for extra security + passcode-protected join flow

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS passcode VARCHAR(32);

COMMENT ON COLUMN meetings.passcode IS 'Optional 4-12 char passcode required by all joiners (in addition to meeting_id)';

-- Index helps quick host-only passcode verification during join
CREATE INDEX IF NOT EXISTS idx_meetings_passcode
  ON meetings (meeting_id) WHERE passcode IS NOT NULL;
