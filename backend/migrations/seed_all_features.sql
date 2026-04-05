-- ============================================================================
-- TeamChatX — Complete Feature Catalog Seed
-- Run this in pgAdmin or psql against your teamChatx database.
-- Uses ON CONFLICT to safely upsert (won't duplicate existing rows).
-- ============================================================================

-- ─── 1. Ensure all categories exist ─────────────────────────────────────────

INSERT INTO feature_categories (category_key, category_label, display_order, status)
VALUES
  ('messaging',      'Messaging',                1, 'active'),
  ('group',          'Group Chat',               2, 'active'),
  ('audio_video',    'Audio & Video',            3, 'active'),
  ('collaboration',  'Collaboration',            4, 'active'),
  ('productivity',   'Productivity',             5, 'active'),
  ('filters',        'Filters & Media',          6, 'active'),
  ('security',       'Security & Privacy',       7, 'active'),
  ('admin',          'Admin & Organization',      8, 'active'),
  ('ai_features',    'AI Features',              9, 'active'),
  ('integrations_cs','Integrations (Coming Soon)',10, 'active'),
  ('automation_cs',  'Automation (Coming Soon)', 11, 'active')
ON CONFLICT (category_key) DO UPDATE
  SET category_label = EXCLUDED.category_label,
      display_order  = EXCLUDED.display_order;


-- ─── 2. Insert ALL feature items ────────────────────────────────────────────

-- ======================== MESSAGING ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'One-on-One Messaging',
   'Send and receive direct messages in real-time with delivery and read receipts.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Rich Text Formatting',
   'Format messages with Bold, Italic, and Underline styling via toolbar or keyboard shortcuts.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Code Block Messages',
   'Share code snippets with syntax highlighting and language detection.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Emoji Messages',
   'Send emoji-only messages with enlarged display and animated emoji support.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Link Preview',
   'Auto-detect URLs and display rich link previews with title, description, and thumbnail.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   '@Mentions',
   'Tag team members with @mention autocomplete suggestions in conversations.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Reply',
   'Reply to specific messages with quoted context for threaded conversations.',
   7),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Forward',
   'Forward messages to other chats or groups with forwarded label indicator.',
   8),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Edit',
   'Edit sent messages with edit history tracking and edited timestamp.',
   9),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Delete & Unsend',
   'Delete messages for yourself or recall/unsend for both sides.',
   10),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Reactions',
   'React to messages with emoji reactions visible to all participants.',
   11),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Multi-Select Messages',
   'Select multiple messages for batch copy, forward, or delete operations.',
   12),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Audio Messaging',
   'Record and send voice messages with pause/resume and duration tracking.',
   13),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Message Copy',
   'Copy message text, code, or images to clipboard with one click.',
   14),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Show More / Show Less',
   'Auto-collapse long messages (4+ lines or 300+ characters) with expand toggle.',
   15),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'),
   'Draft Persistence',
   'Drafts saved per-thread including text, attachments, and audio recordings.',
   16)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== GROUP CHAT ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'group'),
   'Group Chat',
   'Create and manage group conversations with multiple members and admin roles.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'group'),
   'Group Polls',
   'Create interactive polls with single or multiple choice voting, edit, and end controls.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'group'),
   'Group Member Management',
   'Add, remove, and manage group members with admin and member roles.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'group'),
   'Group Timeline',
   'Audit-style event history tracking all group actions and changes.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'group'),
   'Create Group (In-Chat)',
   'Create groups directly from the chat sidebar with member search and selection.',
   5)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== AUDIO & VIDEO ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Audio Call',
   '1:1 audio calls via WebRTC with mute toggle, call timer, and ringtone sounds.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Video Call',
   '1:1 video calls via WebRTC with camera toggle, fullscreen mode, and minimize.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Screen Share',
   'Share your screen with peers via WebRTC for real-time collaboration.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Screen Share Annotation',
   'Draw and annotate on shared screen in real-time with drawing tools.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Remote Control',
   'Request and grant remote control of shared screen during screen share sessions.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Call Sounds',
   'Audio cues for incoming ringtone, outgoing ring, connected chime, and call ended tone.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'),
   'Video Recording',
   'Record and send video messages directly from the chat composer.',
   7)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== COLLABORATION ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'File Sharing',
   'Share documents, images, and files up to 2 GB with upload progress tracking.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Image Sharing',
   'Share images with gallery overlay, full-size preview, and navigation arrows.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Drag & Drop Files',
   'Drag files into the composer area to attach them to your message.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Clipboard Image Paste',
   'Paste screenshots and images directly from clipboard into the composer.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Pin Messages',
   'Pin important messages for quick reference. Each user sees their own pins.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Export Chat',
   'Download conversations as formatted PDF or plain text file.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Contact Info Sidebar',
   'View shared media, links, documents, and pinned messages in the info panel.',
   7),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'Message Info',
   'View sent, delivered, and read timestamps with geo location and device info.',
   8),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'),
   'File Preview Overlay',
   'Preview images, videos, audio, PDFs, Office docs, and code files without downloading.',
   9)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== PRODUCTIVITY ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Full-Database Search',
   'Search across ALL messages in the database, not just loaded messages.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Keyboard Shortcuts',
   'Format text (Ctrl+B/I/U) and send messages with keyboard shortcuts.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Typing Indicator',
   'See when other users are typing with real-time animated indicator.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Online Status',
   'View user online, offline, or idle status with device type indicator.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Read Receipts',
   'Single tick (sent), double tick (delivered), green tick (read) on messages.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'Unread Count Badge',
   'Real-time unread message count badge on chat sidebar threads.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'),
   'User Timezone',
   'Display all chat timestamps in user-selected timezone (335 timezones supported).',
   7)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== FILTERS & MEDIA ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
   'Filter by Images',
   'Browse all shared images in a thread from the full database with counts.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
   'Filter by Media',
   'Browse all shared video and audio files in a thread.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
   'Filter by Links',
   'Browse all shared links with preview cards and hostname display.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
   'Filter by Documents',
   'Browse all shared documents, code files, and archives.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'),
   'Filter by Pinned',
   'View all messages you have pinned in a thread.',
   5)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== SECURITY & PRIVACY ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'End-to-End Encryption',
   'AES-256-GCM encryption for all messages and metadata across all channels.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'Burnout Chat',
   'Exchange sensitive details in self-destruct chat sessions without permanent history.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'Dangerous File Blocking',
   'Block executable and harmful file uploads (.exe, .bat, .dll, macros, etc.).',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'Trusted Device Management',
   'View, manage, and revoke trusted devices from your account.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'Session Control',
   'Single device logout or logout all devices with session revocation.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'CSRF Protection',
   'Cross-Site Request Forgery protection on all unsafe HTTP methods.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'),
   'Refresh Token Reuse Detection',
   'Detect reused refresh tokens and force security logout across all devices.',
   7)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== ADMIN & ORGANIZATION ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Activity Logs',
   'Track security, admin, and billing actions with audit-ready event history.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Organization Message Permissions',
   'Control message actions like edit, delete, forward, and recall at org level.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Quick Add Users',
   'Onboard new members rapidly using minimal required fields from admin panel.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Owner Dashboard',
   'System monitoring with socket stats, database stats, and server health.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'AI Provider Management',
   'Configure and switch AI providers (Gemini, OpenAI, Claude) from owner dashboard.',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Role-Based Access Control',
   'Owner, admin, member, and restricted role permissions across the platform.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Organization Restrictions',
   'IP-based and platform-based access restrictions for enhanced security.',
   7),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Department & Designation Management',
   'CRUD operations for departments, designations, and locations within the org.',
   8),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'),
   'Billing & Subscription',
   'Plan pricing, coupon discounts, Stripe checkout, payment history, and PDF invoices.',
   9)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== AI FEATURES ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Smart Search',
   'Natural language search powered by AI. Ask questions like "files shared by Bhavesh last week".',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Summary',
   'Summarize messages, PDFs, DOCX, images, and code files into key bullet points.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Message Assist',
   'Generate concise, professional drafts and improve clarity before sending.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Tone Adjuster',
   'Rewrite messages in Formal, Friendly, Diplomatic, or Professional tone.',
   4),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Smart Compose',
   'Real-time autocomplete suggestions as you type (10+ characters triggers AI).',
   5),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Grammar Correction',
   'Automatic grammar and spelling correction with accept/dismiss options.',
   6),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Voice-to-Text',
   'Convert audio and voice messages to polished text using OpenAI Whisper or Gemini.',
   7),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Smart Reply',
   'AI-generated 3 professional reply suggestions matching sender language.',
   8),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Auto-Translate',
   'Translate messages to any of 14 languages before sending with one-click convert.',
   9),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Call Notes',
   'Auto-generate structured meeting notes with summary, key points, and action items.',
   10),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Semantic Search',
   'Search messages by meaning, not exact keywords. Finds relevant results using AI.',
   11),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'),
   'AI Live Assistant',
   'Intelligent role-aware AI support agent with conversation history and feedback.',
   12)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== INTEGRATIONS (Coming Soon) ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'integrations_cs'),
   'Slack Integration',
   'Connect TeamChatX with Slack for cross-platform messaging.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'integrations_cs'),
   'Google Workspace',
   'Integrate with Google Drive, Calendar, and Meet.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'integrations_cs'),
   'Microsoft 365',
   'Connect with Teams, OneDrive, and Outlook.',
   3),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'integrations_cs'),
   'Webhook Support',
   'Send and receive webhooks for custom automation workflows.',
   4)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ======================== AUTOMATION (Coming Soon) ========================
INSERT INTO feature_items (feature_category_id, title, description, display_order)
VALUES
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'automation_cs'),
   'Auto-Responder',
   'Set automatic replies when you are away or out of office.',
   1),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'automation_cs'),
   'Scheduled Messages',
   'Schedule messages to be sent at a specific date and time.',
   2),
  ((SELECT feature_category_id FROM feature_categories WHERE category_key = 'automation_cs'),
   'Workflow Triggers',
   'Automate actions based on message keywords, mentions, or events.',
   3)
ON CONFLICT (feature_category_id, title) DO UPDATE
  SET description   = EXCLUDED.description,
      display_order = EXCLUDED.display_order;


-- ─── Verify ─────────────────────────────────────────────────────────────────
-- Run these after to confirm:

-- SELECT fc.category_label, COUNT(fi.feature_item_id) AS items
-- FROM feature_categories fc
-- LEFT JOIN feature_items fi ON fi.feature_category_id = fc.feature_category_id
-- GROUP BY fc.category_label, fc.display_order
-- ORDER BY fc.display_order;
