-- Migration 063: Seed all new mobile app features into feature_items

-- ======================== MESSAGING ========================

-- 1) Swipe to Reply
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Swipe to Reply',
  'Swipe right on any message to instantly trigger a reply — with haptic feedback and spring animation.',
  25
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 2) Starred / Bookmarked Messages
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Starred Messages',
  'Star important messages for quick access. View all starred messages in a dedicated screen from settings.',
  26
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 3) Voice Playback Speed
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Voice Playback Speed',
  'Play voice messages at 1x, 1.5x, or 2x speed with a single tap — cycle through speeds inline.',
  27
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 4) Image Viewer
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
  'Full-Screen Image Viewer',
  'Tap any image to view full-screen with double-tap zoom (1x to 2.5x) and caption overlay.',
  10
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 5) Chat Wallpaper
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Chat Wallpaper',
  'Set a custom background image per chat from your photo library for a personalized experience.',
  12
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ======================== PRODUCTIVITY ========================

-- 6) Pin Chat to Top
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Pin Chat to Top',
  'Long-press any chat to pin it to the top of the list for quick access. Pinned chats show a pin icon.',
  13
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 7) Archive Chat
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Archive Chat',
  'Long-press to archive chats and hide them from the main list. Archived chats are preserved but out of sight.',
  14
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 8) Storage Manager
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Storage Manager',
  'View storage usage breakdown (message cache, downloads, drafts, starred) with clear buttons per category.',
  15
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 9) Unread Badge on App Icon
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Unread Badge on App Icon',
  'App icon automatically shows total unread message count as a badge number.',
  16
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 10) Chat Filters
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
  'Chat List Filters',
  'Filter chat list by All, Groups, or Unread with pill-shaped filter chips and live count badges.',
  11
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 11) Department Filter
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
  'Department-wise Contacts',
  'Filter contacts by department with horizontal scrollable chips — quickly find team members by department.',
  10
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ======================== SECURITY ========================

-- 12) App Lock (PIN + Biometric)
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'App Lock (PIN + Biometric)',
  'Lock the app with a 4-digit PIN or biometric (fingerprint/face). Auto-locks after 30 seconds in background.',
  11
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 13) QR Code Login
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'QR Code Login',
  'Scan a QR code from the web browser to instantly login — no need to type credentials on desktop.',
  12
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ======================== COLLABORATION ========================

-- 14) Custom Status
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Custom Availability Status',
  'Set your status to Available, Busy, Away, DND, or Offline with an optional custom status message.',
  10
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 15) Draft Auto-Save
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Draft Auto-Save',
  'Unsent messages are automatically saved as drafts per chat and restored when you return.',
  28
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 16) Chat Export
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Chat Export',
  'Export entire chat history as a text file and share via any app on your device.',
  17
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 17) Emoji Reactions
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Emoji Reactions',
  'Quick-react to any message with emoji. See who reacted with count badges. Toggle your own reactions.',
  29
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 18) Typing Indicator
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Real-time Typing Indicator',
  'See when the other person is typing in real-time — shown in the chat header.',
  30
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 19) Online/Last Seen Status
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'Real-time Presence Status',
  'See online, away, idle, busy, and offline status in real-time with color-coded dots on avatars.',
  11
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 20) Polls
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
  'In-Chat Polls',
  'Create single or multiple choice polls directly in chat. Vote inline with live progress bars and counts.',
  12
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 21) Media Gallery
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
  'Media Gallery & Files Tab',
  'View all shared media, files, links, and pinned messages in organized tabs per chat.',
  12
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 22) Global Member Badge
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
  'Global Member Orange Badge',
  'Global/orange members are identified with a distinctive orange dot on their avatar across all screens.',
  11
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;
