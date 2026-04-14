# Database Migration Guide

Last updated: 2026-03-10

This page explains how to run SQL migrations from the `migrations/` folder.

## Prerequisites

- PostgreSQL installed and running
- Database created (example: `teamChatx`)
- `psql` command available in terminal

Optional env vars used below:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_NAME`
- `DB_PASSWORD` (set as `PGPASSWORD`)

## Migration Files (Current Order)

Run in this exact order:

1. `migrations/001_init.sql`
2. `migrations/002_org_members_department_designation.sql`
3. `migrations/003_org_members_location.sql`
4. `migrations/004_activity_log.sql`
5. `migrations/005_global_access.sql`
6. `migrations/006_global_access_allow_user_org_scope.sql`
7. `migrations/007_performance_indexes.sql`
8. `migrations/008_activity_log_query_optimizations.sql`
9. `migrations/009_groups_and_related_tables.sql`
10. `migrations/010_group_members_timeline_perf.sql`
11. `migrations/011_groups_lookup_indexes.sql`
12. `migrations/012_api_hotpath_indexes.sql`
13. `migrations/013_org_message_menu_permissions.sql`
14. `migrations/014_site_details.sql`
15. `migrations/015_site_details_remove_organization_id_and_truncate.sql`
16. `migrations/016_product_features.sql`
17. `migrations/017_contact_us.sql`
18. `migrations/018_organization_access_restrictions.sql`
19. `migrations/019_user_devices_add_updated_at.sql`
20. `migrations/020_user_devices_add_hostname_os_name.sql`
21. `migrations/021_designation_uniqueness_by_department.sql`
22. `migrations/022_countries_states_master.sql`
23. `migrations/023_coupons_master.sql`
24. `migrations/024_payment_history_billing_metadata.sql`
25. `migrations/025_billing_addresses.sql`
26. `migrations/026_currencies_master_top50.sql`
27. `migrations/027_plans_default_currency.sql`
28. `migrations/028_add_created_updated_at_to_all_tables.sql`
29. `migrations/029_payment_history_status_and_period_months.sql`
30. `migrations/030_reset_and_seed_plans_reasonable_pricing.sql`
31. `migrations/031_payment_history_strong_uniques.sql`
32. `migrations/032_payment_history_failure_reason_jsonb.sql`
33. `migrations/033_reset_currencies_to_stripe_supported.sql`
34. `migrations/034_drop_coupon_currency_code.sql`
35. `migrations/035_seed_feature_items_full_catalog.sql`

## Method 1: Run One-by-One (Recommended)

From project root:

```powershell
$env:PGPASSWORD="postgres"
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/001_init.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/002_org_members_department_designation.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/003_org_members_location.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/004_activity_log.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/005_global_access.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/006_global_access_allow_user_org_scope.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/007_performance_indexes.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/008_activity_log_query_optimizations.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/009_groups_and_related_tables.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/010_group_members_timeline_perf.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/011_groups_lookup_indexes.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/012_api_hotpath_indexes.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/013_org_message_menu_permissions.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/014_site_details.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/015_site_details_remove_organization_id_and_truncate.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/016_product_features.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/017_contact_us.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/018_organization_access_restrictions.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/019_user_devices_add_updated_at.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/020_user_devices_add_hostname_os_name.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/021_designation_uniqueness_by_department.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/022_countries_states_master.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/023_coupons_master.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/024_payment_history_billing_metadata.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/025_billing_addresses.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/026_currencies_master_top50.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/027_plans_default_currency.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/028_add_created_updated_at_to_all_tables.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/029_payment_history_status_and_period_months.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/030_reset_and_seed_plans_reasonable_pricing.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/031_payment_history_strong_uniques.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/032_payment_history_failure_reason_jsonb.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/033_reset_currencies_to_stripe_supported.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/034_drop_coupon_currency_code.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/035_seed_feature_items_full_catalog.sql
```

## Method 2: Run All in a Loop (PowerShell)

```powershell
$env:PGPASSWORD="postgres"
$files = @(
  "migrations/001_init.sql",
  "migrations/002_org_members_department_designation.sql",
  "migrations/003_org_members_location.sql",
  "migrations/004_activity_log.sql",
  "migrations/005_global_access.sql",
  "migrations/006_global_access_allow_user_org_scope.sql",
  "migrations/007_performance_indexes.sql",
  "migrations/008_activity_log_query_optimizations.sql",
  "migrations/009_groups_and_related_tables.sql",
  "migrations/010_group_members_timeline_perf.sql",
  "migrations/011_groups_lookup_indexes.sql",
  "migrations/012_api_hotpath_indexes.sql",
  "migrations/013_org_message_menu_permissions.sql",
  "migrations/014_site_details.sql",
  "migrations/015_site_details_remove_organization_id_and_truncate.sql",
  "migrations/016_product_features.sql",
  "migrations/017_contact_us.sql",
  "migrations/018_organization_access_restrictions.sql",
  "migrations/019_user_devices_add_updated_at.sql",
  "migrations/020_user_devices_add_hostname_os_name.sql",
  "migrations/021_designation_uniqueness_by_department.sql",
  "migrations/022_countries_states_master.sql",
  "migrations/023_coupons_master.sql",
  "migrations/024_payment_history_billing_metadata.sql",
  "migrations/025_billing_addresses.sql",
  "migrations/026_currencies_master_top50.sql",
  "migrations/027_plans_default_currency.sql",
  "migrations/028_add_created_updated_at_to_all_tables.sql",
  "migrations/029_payment_history_status_and_period_months.sql",
  "migrations/030_reset_and_seed_plans_reasonable_pricing.sql",
  "migrations/031_payment_history_strong_uniques.sql",
  "migrations/032_payment_history_failure_reason_jsonb.sql",
  "migrations/033_reset_currencies_to_stripe_supported.sql",
  "migrations/034_drop_coupon_currency_code.sql",
  "migrations/035_seed_feature_items_full_catalog.sql"
)

foreach ($f in $files) {
  Write-Host "Running $f ..."
  psql -h localhost -p 5432 -U postgres -d teamChatx -f $f
  if ($LASTEXITCODE -ne 0) {
    throw "Migration failed: $f"
  }
}

Write-Host "All migrations completed."
```

## Verify Migrations

Check key tables:

```sql
\dt
```

Check `global_access`, activity log, and group tables:

```sql
\d global_access
\d activity_log
\d groups
\d group_members
\d group_timeline
\d plan_features
\d site_details
\d site_detail_emails
\d site_detail_phones
\d site_detail_addresses
\d feature_categories
\d feature_items
\d contact_us_requests
```

Check performance indexes:

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN (
  'global_access',
  'organization_members',
  'activity_log',
  'otp_verifications',
  'groups',
  'group_members',
  'group_timeline',
  'plan_features',
  'departments',
  'designations',
  'locations',
  'site_details',
  'site_detail_emails',
  'site_detail_phones',
  'site_detail_addresses',
  'feature_categories',
  'feature_items',
  'contact_us_requests'
)
ORDER BY tablename, indexname;
```

`013_org_message_menu_permissions.sql` adds:
- table: `organization_message_menu_permissions`
- index: `idx_menuperm_org_id`
- status column + check:
  - `status VARCHAR(20) NOT NULL DEFAULT 'active'`
  - `CHECK (status IN ('active', 'inactive'))`

`014_site_details.sql` adds:
- table: `site_details` (initially with `organization_id`)
- table: `site_detail_emails` (multiple emails)
- table: `site_detail_phones` (multiple phone numbers)
- table: `site_detail_addresses` (multiple addresses)

`015_site_details_remove_organization_id_and_truncate.sql` changes:
- truncates all records from:
  - `site_details`
  - `site_detail_emails`
  - `site_detail_phones`
  - `site_detail_addresses`
- removes `organization_id` from `site_details`

`016_product_features.sql` adds:
- table: `feature_categories`
- table: `feature_items`
- seed categories:
  - `messaging`, `group`, `audio_video`, `collaboration`, `productivity`, `filters`, `security`, `admin`, `ai_features`
- seed items in `messaging`:
  - `One-On-One Messaging`
  - `Audio Messaging`
  - `Forkout`

`035_seed_feature_items_full_catalog.sql` adds:
- complete tab+item seed coverage for all feature categories:
  - `messaging`, `group`, `audio_video`, `collaboration`, `productivity`, `filters`, `security`, `admin`, `ai_features`
  - `integrations_cs`, `automation_cs` (coming soon categories)
- idempotent upsert behavior:
  - category insert uses `ON CONFLICT (category_key) DO UPDATE`
  - item insert uses `ON CONFLICT (feature_category_id, title) DO UPDATE`
- this migration can be rerun safely to refresh catalog copy/order/status.

`017_contact_us.sql` adds:
- table: `contact_us_requests`
- fields:
  - `name`, `country_code`, `mobile_number`, `email_address`, `company_name`, `total_users`, `requirement_details`
  - workflow status: `new|reviewed|closed`

`018_organization_access_restrictions.sql` adds/updates:
- table: `organization_ip_restrictions`
  - `status` column: `active|inactive`
  - unique rule: `(organization_id, ip_address)`
- table: `organization_platform_restrictions`
  - `restriction_type`: `allow|block`
  - `status` column: `active|inactive`
  - unique rule: `(organization_id, platform_id)`
- safe alter logic for existing DB where table exists but `status` column is missing

`021_designation_uniqueness_by_department.sql` updates:
- drops old constraint: `uk_desig_org_name` on `designations`
- adds new constraint: `uk_desig_org_dept_name`
- uniqueness becomes: `(organization_id, department_id, name)`
- result: same designation name allowed in different departments of same organization

Runtime config note:
- contact module admin mail recipient: `.env CONTACT_US_NOTIFY_TO`
- recommended value: `support@teamchatx.com`

`plan_features` module notes:
- current schema is documented in `docs/database.md` under `CREATE TABLE plan_features`.
- if your DB is older and table missing, run the `plan_features` DDL block from `docs/database.md`.

If you only want to apply `status` change manually:

```sql
ALTER TABLE organization_message_menu_permissions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_organization_message_menu_permissions_status'
  ) THEN
    ALTER TABLE organization_message_menu_permissions
    ADD CONSTRAINT chk_organization_message_menu_permissions_status
    CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;
```

## JWT Expiry Config Change Note

`JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` env changes are runtime config updates.
- in values ko change karne ke liye DB migration required nahi hoti.
- effect new login/refresh cycles par apply hota hai.
- already-issued tokens apni original expiry ke saath remain karte hain.

## Common Errors

- `relation already exists`
  - means migration already run; check if file uses `IF NOT EXISTS`.
- `permission denied`
  - DB user lacks create/alter privileges.
- `psql: command not found`
  - install PostgreSQL client tools or add `psql` to PATH.
- foreign key errors while applying data manually
  - run migrations first, then seed data in valid order.

## Reset (Dev Only)

If needed, use reset queries from `docs/query.md` and rerun migrations from `001`.

## Update Log (2026-02-25)

- Migration list verified through `017_contact_us.sql`.
- Contact Us runtime env key documented: `CONTACT_US_NOTIFY_TO`.
- Migration list extended with `018_organization_access_restrictions.sql`.

## Update Log (2026-03-02)

- Migration order extended with:
  - `021_designation_uniqueness_by_department.sql`
- Added migration notes for designation uniqueness scope shift:
  - old `uk_desig_org_name` dropped.
  - new `uk_desig_org_dept_name` applied.

## Update Log (2026-03-09)

- Added migration references and verification notes for:
  - `022_countries_states_master.sql`
  - `023_coupons_master.sql`
  - `024_payment_history_billing_metadata.sql`
- Billing metadata guidance synchronized with payment history updates.

## Update Log (2026-03-09, Docs Sync 2)

- Confirmed latest billing address-flow updates required no additional schema migration:
  - multi-address selection and `create_new` behavior are service-layer changes over existing `billing_addresses`.

## Update Log (2026-03-10)

- Migration order extended through:
  - `030_reset_and_seed_plans_reasonable_pricing.sql`
  - `031_payment_history_strong_uniques.sql`
  - `032_payment_history_failure_reason_jsonb.sql`
  - `033_reset_currencies_to_stripe_supported.sql`
  - `034_drop_coupon_currency_code.sql`
  - `035_seed_feature_items_full_catalog.sql`
- Added feature-catalog seeding guidance for complete `feature_items` coverage across all tabs, including coming soon categories.
  - manual country/state text input is validation/UX change, not table DDL change.

## Update Log (2026-03-09, Plans Currency Migration)

- Added `027_plans_default_currency.sql`:
  - adds `plans.default_currency`
  - backfills existing plans with `INR`
  - enforces 3-letter uppercase currency check

## Update Log (2026-03-09, Plan Reset + Seed)

- Added `030_reset_and_seed_plans_reasonable_pricing.sql`:
  - ensures `plans.default_currency` exists
  - truncates `payment_history`, `subscriptions`, and `plans` (dev reset scope)
  - seeds 4 plans with INR pricing:
    - `trial` (14 days, free)
    - `startup` (199/user/month)
    - `basic` (299/user/month)
    - `business` (499/user/month)

## Update Log (2026-03-09, Payment Idempotency Constraints)

- Added `031_payment_history_strong_uniques.sql`:
  - normalizes blank `transaction_id` values to `NULL`
  - deduplicates old duplicate `transaction_id` rows by keeping latest row and nullifying older duplicates
  - ensures unique constraint for `invoice_number` exists
  - adds partial unique index on `transaction_id` (`WHERE transaction_id IS NOT NULL`)



## Update Log (2026-03-09, Latest Sync)

- Billing confirm idempotency hardened for same `session_id`.
- Payment history constraints strengthened:
  - `invoice_number` uniqueness guard.
  - partial unique index on `transaction_id` (`IS NOT NULL`).
- Billing invoice download now exports real `.pdf` (A4 style) with transaction id.
- Admin payment success UX improved:
  - duplicate confirm call removed.
  - success modal auto-close in 2s.
  - confetti visibility fixed.
- Billing UI updates:
  - Subscription Overview uses preset/theme palette colors.
  - readability improved for top status chips.
- User management updates:
  - add user flow optimized (non-blocking credential mail + faster dialog close).
  - role mapping locked:
    - organization create default role = `3`.
    - user form platform admin = `2`, otherwise `4`.
  - default toggles remain unchecked unless user explicitly selects.
- Added/updated migrations:
  - `030_reset_and_seed_plans_reasonable_pricing.sql`
  - `031_payment_history_strong_uniques.sql`
# Docs Sync (2026-03-10)

- Recent billing-related migration history includes:
  - `031_payment_history_strong_uniques.sql`
  - `032_payment_history_failure_reason_jsonb.sql`
  - `033_reset_currencies_to_stripe_supported.sql`
- Current invoice format is application-generated from `payment_history.payment_id`; no additional migration was needed for that formatting change.

---

# Docs Sync (2026-04-14) — today's migrations

## 069_push_subscriptions.sql
Web Push (VAPID) subscription store for service-worker background notifications.
`push_subscriptions(subscription_id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at, last_used_at)`.
Indexes: `endpoint` unique, `user_id`.

## 070_meeting_guests.sql
External (email-invited) meeting guests. One row per (meeting, email); the
`access_token` goes in the invite URL, the `access_code` is the 6-digit code
the guest types.
`meeting_guests(guest_id, meeting_id FK, email, display_name, access_token UNIQUE, access_code, invited_by, invited_at, joined_at, revoked_at)`.
Indexes: `(meeting_id, email)` unique, `access_token`.

## 071_call_logs.sql
Dedicated audio/video call history, indexed for both caller and callee.
`call_logs(call_log_id, organization_id, caller_id, callee_id, call_type, outcome, started_at, ended_at, duration_seconds, created_at)`.
`outcome` ∈ `missed | declined | no_answer | offline | answered`.
Indexes: `(caller_id, created_at DESC)`, `(callee_id, created_at DESC)`, `(organization_id, created_at DESC)`.

## 072_user_thread_pins.sql
Per-user pinned chat threads. Soft cap of 20 enforced in the model.
`user_thread_pins(pin_id, user_id, organization_id, thread_id, pinned_at)`.
Indexes: `(user_id, organization_id, thread_id)` unique, `(user_id, organization_id)`.

## 073_seed_today_features.sql
Idempotent `INSERT … ON CONFLICT` seeding 14 new `feature_items` across the
`audio_video`, `collaboration`, `messaging` and `security` categories — one
row per user-facing feature shipped on 2026-04-14.

## run_on_neon_today.sql
Paste-ready combined script covering 069 → 073 for the Neon SQL Editor.
Every statement is `IF NOT EXISTS` / `ON CONFLICT`, so re-running is safe.
