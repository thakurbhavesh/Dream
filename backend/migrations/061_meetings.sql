-- Migration 061: Meetings / Video conferencing
CREATE TABLE IF NOT EXISTS meetings (
  id               BIGSERIAL     PRIMARY KEY,
  meeting_id       VARCHAR(20)   NOT NULL UNIQUE,         -- short join code e.g. "MTG-AB12CD"
  organization_id  BIGINT        NOT NULL,
  host_id          BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title            VARCHAR(200)  NOT NULL DEFAULT 'Untitled Meeting',
  description      TEXT,
  meeting_type     VARCHAR(20)   NOT NULL DEFAULT 'instant', -- instant | scheduled
  status           VARCHAR(20)   NOT NULL DEFAULT 'waiting', -- waiting | active | ended | cancelled
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_minutes INT,
  settings         JSONB         NOT NULL DEFAULT '{
    "video": true,
    "audio": true,
    "screenShare": true,
    "chat": true,
    "whiteboard": true,
    "recording": false,
    "waitingRoom": false,
    "maxParticipants": 50
  }'::jsonb,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_org     ON meetings (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_host    ON meetings (host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_code    ON meetings (meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_sched   ON meetings (scheduled_at) WHERE status = 'waiting';

-- Meeting participants / invitees
CREATE TABLE IF NOT EXISTS meeting_participants (
  id               BIGSERIAL     PRIMARY KEY,
  meeting_id       BIGINT        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id          BIGINT        REFERENCES users(user_id) ON DELETE CASCADE,
  email            VARCHAR(255),                           -- for external guests
  display_name     VARCHAR(100),
  role             VARCHAR(20)   NOT NULL DEFAULT 'participant', -- host | co-host | participant
  rsvp             VARCHAR(20)   NOT NULL DEFAULT 'pending',     -- pending | accepted | declined | tentative
  joined_at        TIMESTAMPTZ,
  left_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meeting  ON meeting_participants (meeting_id);
CREATE INDEX IF NOT EXISTS idx_mp_user     ON meeting_participants (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_unique ON meeting_participants (meeting_id, user_id) WHERE user_id IS NOT NULL;

-- Meeting chat messages (in-meeting chat)
CREATE TABLE IF NOT EXISTS meeting_messages (
  id               BIGSERIAL     PRIMARY KEY,
  meeting_id       BIGINT        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id          BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message          TEXT          NOT NULL,
  message_type     VARCHAR(20)  NOT NULL DEFAULT 'text',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mm_meeting ON meeting_messages (meeting_id, created_at);
