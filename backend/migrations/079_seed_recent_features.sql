-- 079_seed_recent_features.sql
--
-- Add the features actually shipped over the last few sessions to the public
-- catalog. Idempotent (ON CONFLICT DO NOTHING on the
-- (feature_category_id, title) unique index).

-- ─── Messaging ────────────────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('Auto Image Compression',  'Photos are silently resized and re-encoded (JPEG/HEIC → WebP, big images shrunk to 1920px) before upload — typical 50-70 percent size saving with zero UX cost.', 200),
  ('Smart Format Pick',       'Picker chooses the best output format automatically: HEIC → JPEG, opaque PNG → WebP, transparent PNG stays PNG, GIFs untouched so animations are preserved.', 201),
  ('AI Background Removal',   'One tap on any image attachment removes the background using an on-device AI model and sends a clean transparent PNG.', 202),
  ('Anti-Phishing Link Warnings', 'Risky URLs (lookalike domains, raw IPs, known shorteners, suspicious TLDs) get a warning banner above the link preview before the user clicks.', 203)
) AS t(title, description, display_order)
WHERE fc.category_key = 'messaging'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── Audio & Video / Meetings ─────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('Lock Meeting (Host)',     'Host can lock the room with one tap. New joins are rejected; the host can still rejoin after a refresh.',                          200),
  ('Spotlight Speaker',       'Host pins a participant for everyone in the room — perfect for presentations, demos and webinars.',                              201),
  ('Meeting Details View',    'Tap any past meeting card to see start / end / total duration, the host, every member, time-in-call per attendee and re-join sessions.', 202),
  ('Meeting Ended Notice',    'When the host ends a meeting, every other participant sees a clear "Meeting has ended" overlay. Old invite codes immediately stop working.', 203),
  ('Floating Reactions',      'Reaction emojis float up the meeting view (Zoom / Meet style) when participants react.',                                          204),
  ('Picture-in-Picture',      'Pop any participant''s video into a floating browser window so you can keep working while the meeting runs.',                     205)
) AS t(title, description, display_order)
WHERE fc.category_key = 'audio_video'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── Productivity ─────────────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('Inline Notification Reply', 'Reply to a chat directly from the system notification on iOS and Android — the message sends without opening the app.', 200),
  ('Mark-as-Read from Notification', 'A "Mark as read" action on the notification clears the unread state without opening the chat.',                       201)
) AS t(title, description, display_order)
WHERE fc.category_key = 'productivity'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── Admin & Organization ────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('OTP Verifications Tab',   'Admin panel includes a live audit of the last 25 OTP codes sent — channel, purpose, status, attempts, IP and timestamps.', 200),
  ('Meeting Members Audit',   'Past meetings expose the full member list with roles, time spent in call, joined-at and left-at — useful for billing and compliance.', 201)
) AS t(title, description, display_order)
WHERE fc.category_key = 'admin'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── AI Features ──────────────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('AI Background Removal',   'On-device AI runs the @imgly background-removal model in a worker so a single tap turns any photo into a transparent PNG sticker.', 200)
) AS t(title, description, display_order)
WHERE fc.category_key = 'ai_features'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── Mobile & Desktop ─────────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('Inline Reply Notifications (Mobile)', 'Reply to a chat from the iOS / Android notification without opening the app.',                                  200),
  ('Mark Read from Notifications (Mobile)', 'Clear the unread state of a chat from the notification with a single tap.',                                   201),
  ('Single-Instance Desktop',  'Launching the desktop app twice focuses the existing window instead of opening a duplicate socket session.',                202),
  ('Quick-Switch Keyboard Menu', 'Standard application menu on the desktop app exposes Cut / Copy / Paste / Find / Reload / DevTools shortcuts.',           203)
) AS t(title, description, display_order)
WHERE fc.category_key = 'mobile_desktop'
ON CONFLICT (feature_category_id, title) DO NOTHING;

-- ─── Security & Privacy ──────────────────────────────────────────────────
INSERT INTO feature_items (feature_category_id, title, description, display_order, status)
SELECT fc.feature_category_id, t.title, t.description, t.display_order, 'active'
FROM feature_categories fc, (VALUES
  ('JWT Claims Validation',   'Tokens missing required claims (sub, expiry) are rejected at the auth middleware level so malformed tokens never reach controllers.', 200),
  ('Strict Permission Allow-List (Desktop)', 'Desktop app explicitly allows only the permissions actually needed (mic, camera, notifications, clipboard, screen capture, geolocation) and denies everything else.', 201),
  ('Camera Permission Gate (Mobile)', 'Linked-devices QR scanner now prompts for camera permission with a clear "Allow camera" or "Open Settings" fallback.', 202),
  ('Foreign-Key Cascade Hardening', 'Database FKs tightened so deleting a user cascades cleanly through QR sessions, group memberships and orphans nothing.', 203)
) AS t(title, description, display_order)
WHERE fc.category_key = 'security'
ON CONFLICT (feature_category_id, title) DO NOTHING;
