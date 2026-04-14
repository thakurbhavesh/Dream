-- Migration 070: External meeting guests (email-invited, no login)
CREATE TABLE IF NOT EXISTS meeting_guests (
  guest_id      BIGSERIAL    PRIMARY KEY,
  meeting_id    BIGINT       NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255),
  access_token  VARCHAR(64)  NOT NULL UNIQUE,   -- goes in the invite URL (/guest/:token)
  access_code   VARCHAR(12)  NOT NULL,          -- short numeric code the guest types
  invited_by    BIGINT       REFERENCES users(user_id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  joined_at     TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_guests_meeting_email
  ON meeting_guests (meeting_id, email);

CREATE INDEX IF NOT EXISTS idx_meeting_guests_token
  ON meeting_guests (access_token);
