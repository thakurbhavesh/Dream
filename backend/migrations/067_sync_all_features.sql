-- Migration 067: Sync ALL features — add missing ones from Compare + Mobile
-- Safe to run multiple times (ON CONFLICT)

-- ═══ MESSAGING ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'Offline Message Queue', 'Messages sent without internet are queued locally and auto-sent when connection restores. Status shows queued/failed with tap-to-retry.', 31),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'Forward to Multiple Contacts', 'Forward a message to multiple contacts at once with multi-select checkmarks and batch send.', 32),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'XSS Message Sanitization', 'All messages are sanitized server-side to strip script tags, iframes, and event handlers before storage.', 33),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'Message Size Protection', 'Messages limited to 5000 characters to prevent abuse. ThreadId format validated to prevent injection.', 34),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'Chat Export', 'Export entire chat history as a text file and share via any app on your device.', 35),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'messaging'), 'Scheduled Messages', 'Write a message and schedule it to be sent automatically at a specified date and time.', 36)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ COLLABORATION ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'), 'Chat Wallpaper', 'Set a custom background image per chat from your photo library for a personalized experience.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'), 'Broadcast to Groups', 'Send broadcast messages to multiple groups simultaneously from the admin panel.', 14),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'), 'Broadcast with File Attachments', 'Include files, images, and documents in broadcast messages sent to multiple contacts.', 15)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ PRODUCTIVITY ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'), 'Pin / Archive Chats', 'Long-press any chat to pin to top or archive. Pinned chats always appear first with a pin icon.', 18),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'), 'Offline Message Queue', 'Messages queued when offline, auto-retried on reconnect. Visual status: queued/failed/sent.', 19),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'productivity'), 'Custom Notification Sounds', 'Assign unique notification tones per chat for instant recognition without looking at your phone.', 20)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ FILTERS & MEDIA ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'), 'Voice Playback Speed', 'Play voice messages at 1x, 1.5x, or 2x speed with a single tap cycle button.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'filters'), 'Dangerous File Blocking', 'Server-side validation blocks executable files (.exe, .bat, .sh) and oversized uploads to prevent malware.', 14)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ SECURITY ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Device Limit (Max 3)', 'Maximum 3 simultaneous device logins. Shows currently logged-in devices and requires logout before new login.', 14),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Biometric Login', 'Sign in with fingerprint or Face ID after first-time OTP verification. Skips OTP on trusted biometric devices.', 15),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'XSS & Injection Protection', 'All user input sanitized server-side. Script tags, iframes, event handlers stripped. SQL injection prevented with parameterized queries.', 16),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Password Strength Meter', 'Visual 4-level strength indicator on registration: Weak, Fair, Good, Strong based on length, case, numbers, symbols.', 17),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Account Deletion (GDPR)', 'Users can permanently delete their account and all associated data from Settings with confirmation.', 18),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Terms & Privacy Acceptance', 'Mandatory checkbox on registration requiring acceptance of Terms of Service and Privacy Policy.', 19),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'security'), 'Trusted Device OTP Skip', 'Previously OTP-verified devices skip OTP on subsequent logins. Biometric-verified devices also skip.', 20)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ ADMIN ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'OTP Verification Logs', 'Admin panel shows latest 25 OTP verifications with user, status, code (Super Admin only), IP, timestamps.', 12),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'Payment History & Invoices', 'Complete payment history with invoice details, billing info, transaction IDs, and retry for failed payments.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'Mobile Admin Panel', 'Full admin panel on mobile: users, groups, departments, controls, activity logs, OTP logs, billing.', 14),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'IP & Platform Restrictions', 'Restrict access by IP address range and platform type for enhanced enterprise security.', 15),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'Bulk User Upload (CSV)', 'Import multiple users at once via CSV file upload with automatic role and department assignment.', 16),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'admin'), 'Email Invitations', 'Send branded HTML email invitations to new team members with one-click join button.', 17)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ AI FEATURES ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'), 'AI App Guide Assistant', 'In-app AI chatbot that answers questions about TeamChatX features, how-to guides, and troubleshooting in English/Hindi/Hinglish.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'ai_features'), 'AI Call Notes', 'Automatic meeting notes generation from call recordings with key points and action items.', 14)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ AUDIO & VIDEO ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'), 'Screen Annotation', 'Draw, highlight, and annotate on shared screen during meetings for visual collaboration.', 11),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'audio_video'), 'Remote Desktop Control', 'Request and grant remote desktop access during screen share for hands-on IT support.', 12)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;
