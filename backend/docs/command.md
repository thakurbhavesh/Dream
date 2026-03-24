# PostgreSQL psql Commands (Cheat Sheet)

Last updated: 2026-03-10

| Command | Purpose (Kaam) | Syntax / Example | Real-World Use Case |
| --- | --- | --- | --- |
| `\l` | Sabhi databases ki list dikhata hai | `\l` | Naya project start karte waqt check karna ki kaun-kaun se DB hain |
| `\l+` | Databases ki list + extra details (size, tablespace, description) | `\l+` | Disk space check karna ya bade databases identify karna |
| `\c <database_name>` | Dusre database mein switch karna (connect) | `\c teamchatx` | Multiple projects ke beech switch karna |
| `\dt` | Current database ke tables ki list | `\dt` | Jaldi se dekhna ki is DB mein kaun-kaun se tables hain |
| `\dt+` | Tables ki list + size, description, access method | `\dt+` | Table sizes check karna (bada table kaun sa hai) |
| `\dt *.*` | Sabhi schemas ke tables dikhata hai | `\dt *.*` | Public + custom schemas ke tables ek saath dekhne ke liye |
| `\d <table_name>` | Table structure (columns, data types, constraints) | `\d users` | Table ka design ya migration check karna |
| `\d+ <table_name>` | Table ki full detail (indexes, constraints, comments, storage, size) | `\d+ messages` | Performance tuning ya debugging (indexes missing?) |
| `\d <schema>.<table>` | Specific schema wali table ki detail | `\d public.roles` | Jab multiple schemas hote hain (staging, prod) |
| `\dn` | Sabhi schemas ki list | `\dn` | Schema structure samajhne ke liye |
| `\du` / `\dg` | Sabhi users aur roles ki list | `\du` | Permissions check karna (admin vs normal user) |
| `\dx` | Installed extensions ki list | `\dx` | PostGIS, pg_trgm, uuid-ossp jaise extensions check karna |
| `\?` | psql ke saare meta-commands ki list | `\?` | Bhool gaye ho to command kya tha? |
| `\h` | SQL command ka syntax help | `\h SELECT` | Syntax ya options jaldi yaad karne ke liye |
| `\h <command>` | Specific SQL keyword ka detailed help | `\h INSERT INTO` | Complex query likhte waqt syntax confirm karna |
| `\q` | psql se bahar nikalna (quit) | `\q` | Kaam khatam hone ke baad |
| `\! <os_command>` | Shell command chalana (psql ke andar se) | `\! ls -l` | Files check karna ya logs dekhna bina psql se bahar nikle |
| `\x` | Output format toggle (normal ? expanded) | `\x` | Bahut saare columns wale records ko readable banane ke liye |
| `\x auto` | Automatically expanded mode on | `\x auto` | Default setting ke liye (recommended) |
| `\timing` | Har query ka execution time dikhana (toggle) | `\timing` | Query performance compare karna |
| `\set <var> <value>` | Custom variable set karna | `\set today '2026-02-11'` | Repeated values (date, ID) ko baar-baar type na karna |
| `\echo :var` | Variable ki value dikhana | `\echo :today` | Variable confirm karne ke liye |
| `\g` | Last query ko dobara chalana | `\g` | Query modify karke turant test karna |
| `\e` | Last query ko editor mein kholna | `\e` | Lambi query edit karne ke liye |
| `\i <filename>` | External SQL file execute karna | `\i migrations/001_create_users.sql` | Migration scripts ya backup files run karna |

## Useful Commands for Site Details Module

```sql
\d site_details
\d site_detail_emails
\d site_detail_phones
\d site_detail_addresses
```

```sql
TRUNCATE TABLE
  site_detail_addresses,
  site_detail_phones,
  site_detail_emails,
  site_details
RESTART IDENTITY;
```

```powershell
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/015_site_details_remove_organization_id_and_truncate.sql
```

## Useful Commands for Product Features Module

```sql
\d feature_categories
\d feature_items
```

```sql
SELECT * FROM feature_categories ORDER BY display_order ASC, feature_category_id ASC;

SELECT
  fi.feature_item_id,
  fc.category_key,
  fc.category_label,
  fi.title,
  fi.description,
  fi.display_order,
  fi.status
FROM feature_items fi
JOIN feature_categories fc ON fc.feature_category_id = fi.feature_category_id
ORDER BY fc.display_order ASC, fi.display_order ASC, fi.feature_item_id ASC;
```

```powershell
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/016_product_features.sql
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/035_seed_feature_items_full_catalog.sql
```

## Useful Commands for Contact Us Module

```sql
\d contact_us_requests
SELECT * FROM contact_us_requests ORDER BY contact_request_id DESC LIMIT 50;
```

```powershell
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/017_contact_us.sql
```

```powershell
# Check notify recipient env (PowerShell session)
echo $env:CONTACT_US_NOTIFY_TO
```

## Useful Commands for Organization Restrictions Module

```sql
\d organization_ip_restrictions
\d organization_platform_restrictions
```

```sql
SELECT * FROM organization_ip_restrictions ORDER BY restriction_id DESC LIMIT 50;
SELECT * FROM organization_platform_restrictions ORDER BY restriction_id DESC LIMIT 50;
```

```powershell
psql -h localhost -p 5432 -U postgres -d teamChatx -f migrations/018_organization_access_restrictions.sql
```

## Useful Commands for JWT/Session Debug

```sql
\d user_sessions
\d user_devices
```

```sql
SELECT
  session_id,
  user_id,
  status,
  created_at,
  last_used_at,
  expires_at,
  revoked_at
FROM user_sessions
ORDER BY created_at DESC
LIMIT 50;
```

```sql
SELECT
  log_id,
  actor_id,
  action,
  status,
  occurred_at
FROM activity_log
WHERE action IN ('auth.refresh', 'auth.logout', 'auth.logout_all')
ORDER BY occurred_at DESC
LIMIT 50;
```

## Update Log (2026-02-25)

- Added module-specific command references for Site Details, Product Features, and Contact Us.
- Included env check command for `CONTACT_US_NOTIFY_TO`.
- Added migration and table-inspection commands for organization restrictions.

## Update Log (2026-03-09)

- Added billing module inspection commands: `\d coupons`, `\d countries`, `\d states`, `\d payment_history`.
- Added migration references for `022_countries_states_master.sql`, `023_coupons_master.sql`, `024_payment_history_billing_metadata.sql`.

## Update Log (2026-03-09, Docs Sync 2)

- Added billing-address debug table command recommendation:
  - `\d billing_addresses`
  - `SELECT * FROM billing_addresses WHERE organization_id = <org_id> ORDER BY updated_at DESC LIMIT 2;`
- Added coupon seed verification command recommendation:
  - `SELECT coupon_code, discount_type, discount_value, status FROM coupons WHERE coupon_code='WELCOME30';`



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
  - `035_seed_feature_items_full_catalog.sql`
# Docs Sync (2026-03-10)

- Add billing verification coverage when testing commands manually:
  - verify `/billing/checkout-session`
  - verify `/billing/checkout/confirm`
  - verify `/billing/payment-history`
  - verify `/activity-logs`
- Recheck docs whenever invoice format, billing metadata, or activity logging changes.
