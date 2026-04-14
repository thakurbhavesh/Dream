-- ============================================================================
-- Run this on Neon (neon.tech → SQL Editor → paste all → Run)
-- Combined migrations from today's work.
-- Safe to re-run — every statement is idempotent (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

-- ── 069: Web Push subscriptions ─────────────────────────────────────────────
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

-- ── 070: External meeting guests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_guests (
  guest_id      BIGSERIAL    PRIMARY KEY,
  meeting_id    BIGINT       NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255),
  access_token  VARCHAR(64)  NOT NULL UNIQUE,
  access_code   VARCHAR(12)  NOT NULL,
  invited_by    BIGINT       REFERENCES users(user_id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  joined_at     TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_guests_meeting_email
  ON meeting_guests (meeting_id, email);
CREATE INDEX IF NOT EXISTS idx_meeting_guests_token
  ON meeting_guests (access_token);

-- ── 071: Call logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  call_log_id      BIGSERIAL    PRIMARY KEY,
  organization_id  BIGINT       NOT NULL,
  caller_id        BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  callee_id        BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  call_type        VARCHAR(16)  NOT NULL DEFAULT 'audio',
  outcome          VARCHAR(24)  NOT NULL,
  started_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_time
  ON call_logs (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_callee_time
  ON call_logs (callee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_org
  ON call_logs (organization_id, created_at DESC);

-- ── 072: User thread pins ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_thread_pins (
  pin_id          BIGSERIAL    PRIMARY KEY,
  user_id         BIGINT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id BIGINT       NOT NULL,
  thread_id       VARCHAR(50)  NOT NULL,
  pinned_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_thread_pins_unique
  ON user_thread_pins (user_id, organization_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_user_thread_pins_lookup
  ON user_thread_pins (user_id, organization_id);

-- ── 073: Seed today's features into feature_items ──────────────────────────
-- Audio / Video
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Missed Call History in Chat',
  'Declined, unanswered and offline calls automatically post a "Missed audio/video call" entry in the chat so both sides see what they missed.', 40)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Per-Contact Call History',
  'Open a contact''s call history directly from the chat header menu — filter by All, Missed, Audio or Video, with direction icons and duration.', 41)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Live Mute & Camera Indicators',
  'When a participant mutes their mic or turns off their camera during a call, the other side sees a live "muted" / "camera off" badge.', 42)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Minimize-Safe Call Audio',
  'Remote call audio keeps playing uninterrupted even when the call overlay is minimized or moved behind other windows.', 43)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Ring Timeout & Auto-End',
  'Outgoing calls auto-cancel after 45 seconds with a missed-call record if the other side doesn''t pick up.', 44)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Cross-Platform Call Interop',
  'Audio and video calls work reliably between web and mobile clients with a unified WebRTC signaling flow.', 45)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- Collaboration
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'External Guest Meetings',
  'Invite up to 2 external guests per meeting by email. They join via a secure link and 6-digit code — no account, no login required.', 50)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Meeting History',
  'Browse past meetings with host, scheduled time, duration and status in a dedicated tab alongside upcoming meetings.', 51)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Full-Page Meeting Hub',
  'A dedicated meetings workspace with Instant, Schedule and Join tabs, participant picker, settings and upcoming meetings side panel.', 52)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Email Meeting Invitations',
  'Scheduled and instant meetings send branded email invites to internal participants and external guests with a join link + code.', 53)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- Messaging
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Pinned Chats',
  'Pin up to 20 conversations to the top of your chat list. Pin state syncs instantly across tabs and devices via real-time events.', 30)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- Security / Notifications
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Background Web Push',
  'Receive notifications even when the browser tab is closed. Powered by VAPID-signed Web Push through a service worker — no polling.', 30)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Reliable Background Connection',
  'Sockets automatically refresh auth tokens and reconnect when the tab returns from sleep, Wi-Fi switches or the app is backgrounded.', 31)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Incoming Screen-Share Alerts',
  'Get a system notification the moment someone requests to share their screen with you, even if the tab is in the background.', 32)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ── 074: Meeting passcode ───────────────────────────────────────────────────
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS passcode VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_meetings_passcode
  ON meetings (meeting_id) WHERE passcode IS NOT NULL;

-- ── 075: Meeting Phase 2 — co-host, recurring, reminders, attendance ───────
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(16) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_meeting_id BIGINT REFERENCES meetings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meetings_reminder_due
  ON meetings (scheduled_at)
  WHERE meeting_type = 'scheduled'
    AND status = 'waiting'
    AND reminder_sent_at IS NULL;

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

-- ============================================================================
-- Done. Verify:
--   SELECT COUNT(*) FROM push_subscriptions;
--   SELECT COUNT(*) FROM meeting_guests;
--   SELECT COUNT(*) FROM call_logs;
--   SELECT COUNT(*) FROM user_thread_pins;
--   SELECT COUNT(*) FROM feature_items WHERE display_order >= 30;
-- ============================================================================
