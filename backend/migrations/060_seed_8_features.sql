-- Migration 060: Seed all 8 new features into feature_items

-- 1) Chat Mute
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Chat Mute (Per-Chat)',
  'Mute individual chats for 1 hour, 8 hours, 1 week, or forever. Notifications are silently suppressed while badges still update.',
  20
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 2) Scheduled Messages
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Scheduled Messages',
  'Write a message and schedule it to be sent automatically at a specified date and time.',
  21
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 3) GIF Picker (Tenor)
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'GIF Picker (Tenor)',
  'Search and send GIFs from Tenor directly in the chat composer.',
  22
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 4) DND Mode (Do Not Disturb)
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Do Not Disturb (DND)',
  'Silence all notifications with a manual toggle or scheduled quiet hours in profile settings.',
  10
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 5) Voice-to-Text Compose
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Voice-to-Text Compose',
  'Press the mic button and speak — your speech is converted to text in the message composer using Web Speech API.',
  23
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 6) Broadcast List
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
  'Broadcast List',
  'Send one message to multiple contacts simultaneously as individual DMs.',
  24
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 7) Custom Notification Sound Per Chat
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
  'Custom Notification Sound Per Chat',
  'Assign a unique notification tone to each chat for instant recognition.',
  11
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- 8) Disappearing Messages
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES (
  (SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
  'Disappearing Messages',
  'Set a timer (24 hours, 7 days, or 30 days) after which messages automatically disappear from the chat.',
  10
) ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description = EXCLUDED.description, display_order = EXCLUDED.display_order;
