-- Add "Adjust Tone" menu item for AI Tone Adjuster feature.
-- Run once after deploying the tone-adjust feature.

INSERT INTO message_menu_items (menu_key, label, default_status, scope, tone, icon_class, display_order)
VALUES ('tone-adjust', 'Adjust Tone', 'show', 'any', 'normal', 'PiPenNibBold', 125)
ON CONFLICT (menu_key) DO NOTHING;
