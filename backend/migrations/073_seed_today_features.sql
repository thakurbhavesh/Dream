-- Migration 073: Seed features delivered today into feature_items
-- Idempotent — safe to re-run.

-- ─── Audio / Video Calls ───────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Missed Call History in Chat',
  'Declined, unanswered and offline calls automatically post a "Missed audio/video call" entry in the chat so both sides see what they missed.',
  40
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Per-Contact Call History',
  'Open a contact''s call history directly from the chat header menu — filter by All, Missed, Audio or Video, with direction icons and duration.',
  41
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Live Mute & Camera Indicators',
  'When a participant mutes their mic or turns off their camera during a call, the other side sees a live "muted" / "camera off" badge.',
  42
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Minimize-Safe Call Audio',
  'Remote call audio keeps playing uninterrupted even when the call overlay is minimized or moved behind other windows.',
  43
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Ring Timeout & Auto-End',
  'Outgoing calls auto-cancel after 45 seconds with a missed-call record if the other side doesn''t pick up.',
  44
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
  'Cross-Platform Call Interop',
  'Audio and video calls work reliably between web and mobile clients with a unified WebRTC signaling flow.',
  45
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ─── Collaboration / Meetings ─────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'External Guest Meetings',
  'Invite up to 2 external guests per meeting by email. They join via a secure link and 6-digit code — no account, no login required.',
  50
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Meeting History',
  'Browse past meetings with host, scheduled time, duration and status in a dedicated tab alongside upcoming meetings.',
  51
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Full-Page Meeting Hub',
  'A dedicated meetings workspace with Instant, Schedule and Join tabs, participant picker, settings and upcoming meetings side panel.',
  52
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Email Meeting Invitations',
  'Scheduled and instant meetings send branded email invites to internal participants and external guests with a join link + code.',
  53
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ─── Messaging ────────────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Pinned Chats',
  'Pin up to 20 conversations to the top of your chat list. Pin state syncs instantly across tabs and devices via real-time events.',
  30
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ─── Security / Notifications ─────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Background Web Push',
  'Receive notifications even when the browser tab is closed. Powered by VAPID-signed Web Push through a service worker — no polling.',
  30
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Reliable Background Connection',
  'Sockets automatically refresh auth tokens and reconnect when the tab returns from sleep, Wi-Fi switches or the app is backgrounded.',
  31
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Incoming Screen-Share Alerts',
  'Get a system notification the moment someone requests to share their screen with you, even if the tab is in the background.',
  32
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;
