-- Migration 068: Add Mobile & Web/Desktop feature categories with features
-- Safe to run multiple times (ON CONFLICT)

-- ═══ Create new categories ═══
INSERT INTO feature_categories (category_key, category_label, display_order) VALUES
('mobile', 'Mobile', 9),
('web_desktop', 'Web & Desktop', 10)
ON CONFLICT (category_key) DO UPDATE SET category_label = EXCLUDED.category_label;

-- ═══ MOBILE FEATURES ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Native Mobile App (iOS & Android)', 'Full-featured native mobile app with 55+ screens built with React Native and Expo.', 1),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Swipe to Reply', 'Swipe right on any message to instantly reply with haptic feedback.', 2),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Chat Wallpaper', 'Set custom background image per chat from photo library for personalized experience.', 3),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Biometric Login', 'Fingerprint or Face ID login with OTP skip for trusted biometric devices.', 4),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'QR Code Login (Linked Devices)', 'Scan QR from web browser to login — WhatsApp-style linked devices management.', 5),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Screen Share Receive', 'View web user shared screen on mobile during calls in full-screen with PIP.', 6),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Offline Queue with Auto-Retry', 'Messages queued in AsyncStorage when offline, auto-sent on reconnect with retry status.', 7),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Dark Mode (Full Theme)', 'Complete dark mode with WhatsApp-style colors across all 55+ screens.', 8),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Push Notifications', 'Real-time push notifications for messages, calls, and mentions.', 9),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Haptic Feedback', 'Tactile feedback on message actions, reactions, and navigation events.', 10),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Photo Viewer / Gallery', 'Full-screen image viewer with zoom, swipe between images, and share actions.', 11),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Profile Photo Upload', 'Take or choose profile photo from camera or gallery with crop support.', 12),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Contact Photo Viewer', 'Tap any avatar to view full-size profile photo in modal.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Draft Auto-Save', 'Unsent messages saved as drafts, automatically restored when chat is reopened.', 14),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Cache with TTL', 'Intelligent caching for contacts, threads, and messages with 24-hour TTL.', 15),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'mobile'), 'Mobile Admin Panel', 'Full admin panel on mobile — users, groups, departments, billing, OTP logs.', 16)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;

-- ═══ WEB & DESKTOP FEATURES ═══
INSERT INTO feature_items (feature_category_id, title, description, display_order) VALUES
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Web App (Browser)', 'Full-featured app accessible from any modern browser with responsive layout.', 1),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Windows Desktop App', 'Native Windows desktop application with system tray and notifications.', 2),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'QR Code Generator (Login)', 'Generate QR code on web for mobile scan login with auto-authentication.', 3),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Screen Sharing (Presenter)', 'Share entire screen or specific window from web during calls and meetings.', 4),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Multi-Organization Support', 'Switch between multiple organizations and workspaces seamlessly.', 5),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'S3 Cloud Storage Integration', 'AWS S3 integration for scalable, encrypted file storage.', 6),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Stripe Built-In Billing', 'Built-in subscription management, invoices, payment processing via Stripe.', 7),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Web Admin Dashboard', 'Full admin panel with users, groups, departments, billing, activity logs.', 8),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Owner Dashboard', 'Dedicated owner view with org-wide analytics and administrative controls.', 9),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Desktop Notifications', 'Native browser and OS notifications for new messages and incoming calls.', 10),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Keyboard Shortcuts', 'Keyboard shortcuts for common actions and quick navigation.', 11),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Link Preview Cards', 'Auto-generated rich link previews with title, image, and description.', 12),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Code Block Formatting', 'Syntax-highlighted code blocks in messages for developer collaboration.', 13),
((SELECT feature_category_id FROM feature_categories WHERE category_key = 'web_desktop'), 'Polls (Single/Multi Choice)', 'Create and vote on polls within any chat conversation.', 14)
ON CONFLICT (feature_category_id, title) DO UPDATE SET description = EXCLUDED.description;
