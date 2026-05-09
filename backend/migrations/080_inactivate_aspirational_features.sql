-- 080_inactivate_aspirational_features.sql
--
-- Earlier seeds (077, 078, 079) added a bunch of "competitor-parity" feature
-- entries to make the public /features page comparable to Slack/Teams/Zoom.
-- Several of those are not actually shipped in the product yet, so the page
-- ended up advertising things the app can't do.
--
-- This migration flips those aspirational items to status='inactive' so the
-- catalog API stops returning them. They stay in the table (no data loss)
-- and can be re-activated once the underlying feature actually ships.
--
-- Idempotent: only flips rows that are still 'active', so re-running is safe.

-- ─── Audio & Video ─────────────────────────────────────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'audio_video'
   AND i.status = 'active'
   AND i.title IN (
     'Together Mode',
     'Live Captions',
     'Live Translation in Calls',
     'Cloud Recording & Transcript',
     'Whiteboard',
     'Breakout Rooms',
     'Q&A Module',
     'Webinar Mode',
     'Voice Channels',
     'Push-to-Talk',
     'Dial-in by Phone',
     'Floating Reactions',
     'E2EE Calls'
   );

-- ─── Security & Privacy ────────────────────────────────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'security'
   AND i.status = 'active'
   AND i.title IN (
     'Hardware Key (FIDO2)',
     'SAML / SSO',
     'SCIM Provisioning',
     'DLP Rules',
     'Retention Policies',
     'Legal Hold & E-Discovery',
     'Watermark Shared Screen',
     'Screenshot Prevention',
     'Geo-fencing',
     'Custom Domain (White-Label)',
     'Compliance Reports',
     'E2EE Calls'
   );

-- ─── Admin & Organization ──────────────────────────────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'admin'
   AND i.status = 'active'
   AND i.title IN (
     'SSO & SCIM Console',
     'Custom Domain Setup',
     'Compliance Mode (HIPAA / SOC 2)',
     'Audit Log Export'
   );

-- ─── AI Features ───────────────────────────────────────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'ai_features'
   AND i.status = 'active'
   AND i.title IN (
     'AI Knowledge Base (RAG)',
     'AI Voice Cloning',
     'AI Sentiment Warning',
     'AI Auto-Reply When Away',
     'AI Live Translation in Calls'
   );

-- ─── Mobile & Desktop ──────────────────────────────────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'mobile_desktop'
   AND i.status = 'active'
   AND i.title IN (
     'Apple Watch Companion',
     'Wear OS Companion',
     'CarPlay & Android Auto',
     'Siri Shortcuts',
     'Google Assistant Actions',
     'Floating Chat Bubbles'
   );

-- ─── Productivity (Browser Extension is mobile/desktop-adjacent) ───────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'productivity'
   AND i.status = 'active'
   AND i.title = 'Browser Extension';

-- ─── Accessibility (entire category — none are actually implemented) ───────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'accessibility'
   AND i.status = 'active';

-- Hide the empty category from the public page too.
UPDATE feature_categories
   SET status = 'inactive'
 WHERE category_key = 'accessibility'
   AND status = 'active';

-- ─── Plans & Tiers (premium gimmicks not built yet) ────────────────────────
UPDATE feature_items i
   SET status = 'inactive'
  FROM feature_categories c
 WHERE i.feature_category_id = c.feature_category_id
   AND c.category_key = 'platform'
   AND i.status = 'active'
   AND i.title IN (
     'Custom Themes Builder',
     'Stickers Store',
     'Premium Profile Badges',
     'Workspace Boost',
     'Vanity Username'
   );
