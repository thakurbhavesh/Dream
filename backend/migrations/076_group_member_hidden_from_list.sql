-- 076_group_member_hidden_from_list.sql
--
-- Adds per-user "hidden from list" flag to group_members so a user can remove
-- a group thread from their own chat list (e.g. after leaving/being removed)
-- without affecting the group or other members. Purely additive; default FALSE
-- preserves existing behavior for all current rows.

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS hidden_from_list BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_group_members_hidden_from_list
  ON group_members (user_id, organization_id)
  WHERE hidden_from_list = TRUE;
