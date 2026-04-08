-- Migration 062: Deactivate "Jointly Code" feature item
-- Reason: Listed publicly but no implementation exists. Hide from /features page
-- until a real shared-code-editor (e.g., Monaco + Yjs) is built.

UPDATE feature_items
SET status = 'inactive'
WHERE title = 'Jointly Code'
  AND feature_category_id = (
    SELECT feature_category_id FROM feature_categories WHERE category_key = 'collaboration'
  );
