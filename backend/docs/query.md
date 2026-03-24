# TeamChatX SQL Query Reference

Last updated: 2026-03-09

This file documents important SQL patterns used in the project.

## Query Conventions

- PostgreSQL positional params: `$1, $2, ...`
- List APIs use `LIMIT/OFFSET`
- Many lists use `COUNT(*) OVER()` for total count
- Updates usually set `updated_at = NOW()`

## Auth / Onboarding Queries

### Create-account transaction (high level)

1. Check existing user by email

```sql
SELECT user_id
FROM users
WHERE LOWER(email) = LOWER($1)
LIMIT 1;
```

2. Validate default role and plan

```sql
SELECT role_id FROM roles WHERE role_id = 3 LIMIT 1;
SELECT plan_id, interval_days, max_users, max_storage_mb FROM plans WHERE plan_id = 1 LIMIT 1;
```

3. Insert user

```sql
INSERT INTO users (email, name, password_hash, mobile, is_platform_admin, is_global_member)
VALUES ($1, $2, $3, $4, FALSE, FALSE)
RETURNING user_id, email, name, mobile;
```

4. Insert organization

```sql
INSERT INTO organizations (
  org_key, name, subdomain, custom_domain, owner_id, language_id, timezone_id, storage_used_mb, status
)
VALUES ($1, $2, $3, $4, $5, 1, 1, 0, 'active')
RETURNING organization_id, org_key, name, subdomain, custom_domain, storage_used_mb, status;
```

5. Insert membership (`role_id=3`)

```sql
INSERT INTO organization_members (organization_id, user_id, role_id, status)
VALUES ($1, $2, 3, 'active');
```

6. Insert subscription (`plan_id=1`)

```sql
INSERT INTO subscriptions (
  organization_id, plan_id, status, start_date, end_date, max_users, max_storage_mb
)
VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + ($5 * INTERVAL '1 day'), $3, $4);
```

7. Insert OTP

```sql
INSERT INTO otp_verifications (
  user_id, organization_id, identifier, type, otp_code, purpose, status, expires_at, ip_address
)
VALUES ($1, $2, $3, 'email', $4, 'verification', 'pending', NOW() + INTERVAL '10 minutes', $5)
RETURNING otp_id, expires_at;
```

## OTP Verification Queries

```sql
SELECT user_id, email_verified_at
FROM users
WHERE LOWER(email) = LOWER($1)
LIMIT 1;
```

```sql
SELECT *
FROM otp_verifications
WHERE LOWER(identifier) = LOWER($1)
  AND type = 'email'
  AND purpose = 'verification'
ORDER BY created_at DESC
LIMIT 1;
```

```sql
UPDATE otp_verifications
SET status = 'verified', verified_at = NOW()
WHERE otp_id = $1;
```

```sql
UPDATE users
SET email_verified_at = NOW(), updated_at = NOW()
WHERE user_id = $1;
```

## Session and Device Queries

### Create session

```sql
INSERT INTO user_sessions (
  user_id, organization_id, refresh_token_hash, user_agent,
  ip_address, device_id, expires_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
```

### Upsert-like device flow (model logic)

Find latest device by fingerprint:

```sql
SELECT *
FROM user_devices
WHERE user_id = $1
  AND ip_address = $2
  AND COALESCE(user_agent, '') = COALESCE($3, '')
ORDER BY last_active_at DESC
LIMIT 1;
```

Find device by trusted client id (`client_device_id` mapped as `device_name='client:<id>'`):

```sql
SELECT *
FROM user_devices
WHERE user_id = $1
  AND device_name = $2
ORDER BY last_active_at DESC
LIMIT 1;
```

Verify known-device session history (OTP-skip fallback):

```sql
SELECT 1
FROM user_sessions
WHERE user_id = $1
  AND device_id = $2
LIMIT 1;
```

Create device:

```sql
INSERT INTO user_devices (
  user_id, device_name, device_type, ip_address, user_agent,
  latitude, longitude, accuracy_radius, country, city, status, last_active_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW())
RETURNING *;
```

Touch existing device:

```sql
UPDATE user_devices
SET
  device_name = COALESCE($1, device_name),
  device_type = COALESCE($2, device_type),
  latitude = COALESCE($3, latitude),
  longitude = COALESCE($4, longitude),
  accuracy_radius = COALESCE($5, accuracy_radius),
  country = COALESCE($6, country),
  city = COALESCE($7, city),
  status = 'active',
  last_active_at = NOW()
WHERE device_id = $8
RETURNING *;
```

Revoke active sessions for a specific user/device:

```sql
UPDATE user_sessions
SET status = 'revoked', revoked_at = NOW()
WHERE user_id = $1
  AND device_id = $2
  AND status = 'active';
```

Revoke all active sessions for a user:

```sql
UPDATE user_sessions
SET status = 'revoked', revoked_at = NOW()
WHERE user_id = $1
  AND status = 'active';
```

## Organization-Scoped Fetch Queries

Use these when data must be fetched by `organization_id`.

### Organization profile by id

```sql
SELECT o.*, u.name AS owner_name, u.email AS owner_email
FROM organizations o
JOIN users u ON u.user_id = o.owner_id
WHERE o.organization_id = $1
LIMIT 1;
```

### Organization members with role

```sql
SELECT
  om.membership_id,
  om.organization_id,
  om.user_id,
  u.name,
  u.email,
  u.mobile,
  om.role_id,
  r.role_key,
  r.role_name,
  om.status,
  om.joined_at
FROM organization_members om
JOIN users u ON u.user_id = om.user_id
JOIN roles r ON r.role_id = om.role_id
WHERE om.organization_id = $1
ORDER BY om.joined_at DESC
LIMIT $2 OFFSET $3;
```

### Active subscription for organization

```sql
SELECT
  s.subscription_id,
  s.organization_id,
  s.plan_id,
  p.plan_key,
  p.plan_name,
  s.status,
  s.start_date,
  s.end_date,
  s.max_users,
  s.max_storage_mb
FROM subscriptions s
JOIN plans p ON p.plan_id = s.plan_id
WHERE s.organization_id = $1
ORDER BY s.created_at DESC
LIMIT 1;
```

### Departments by organization

```sql
SELECT *
FROM departments
WHERE organization_id = $1
ORDER BY department_id DESC
LIMIT $2 OFFSET $3;
```

### Designations by organization (with department)

```sql
SELECT
  d.designation_id,
  d.organization_id,
  d.department_id,
  d.name,
  d.status,
  d.created_at,
  d.updated_at,
  dept.name AS department_name,
  dept.status AS department_status
FROM designations d
LEFT JOIN departments dept ON dept.department_id = d.department_id
WHERE d.organization_id = $1
ORDER BY d.designation_id DESC
LIMIT $2 OFFSET $3;
```

### Locations by organization

```sql
SELECT *
FROM locations
WHERE organization_id = $1
ORDER BY location_id DESC
LIMIT $2 OFFSET $3;
```

### User sessions by organization

```sql
SELECT
  session_id,
  user_id,
  organization_id,
  status,
  created_at,
  last_used_at,
  expires_at,
  revoked_at,
  device_id,
  ip_address,
  user_agent
FROM user_sessions
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

### OTP logs by organization

```sql
SELECT
  otp_id,
  user_id,
  organization_id,
  identifier,
  type,
  purpose,
  status,
  attempt_count,
  max_attempts,
  created_at,
  expires_at,
  verified_at
FROM otp_verifications
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

## Master CRUD Reminder

For master models (`roles`, `plans`, `languages`, `timezones`, `platforms`, `message_menu_items`, `departments`, `designations`, `locations`) current delete pattern is:

```sql
DELETE FROM <table>
WHERE <id_col> = $1
RETURNING <id_col>;
```

## Plan Features Query Pack (`/plan-features`)

### Create feature

```sql
INSERT INTO plan_features (
  plan_id,
  feature_name,
  feature_description,
  feature_icon,
  section_label,
  display_order,
  status
)
VALUES ($1, $2, $3, $4, COALESCE($5, 'Plan Features'), COALESCE($6, 10), COALESCE($7, 'active'))
RETURNING *;
```

### List features (search + filters + pagination)

```sql
SELECT
  pf.*,
  p.plan_key,
  p.plan_name,
  COUNT(*) OVER() AS total_count
FROM plan_features pf
JOIN plans p ON p.plan_id = pf.plan_id
WHERE ($1::bigint IS NULL OR pf.plan_id = $1)
  AND ($2::varchar IS NULL OR pf.status = $2)
  AND (
    $3::varchar IS NULL
    OR pf.feature_name ILIKE $3
    OR COALESCE(pf.feature_description, '') ILIKE $3
    OR COALESCE(pf.section_label, '') ILIKE $3
    OR COALESCE(p.plan_name, '') ILIKE $3
  )
ORDER BY pf.plan_id ASC, pf.display_order ASC, pf.plan_feature_id DESC
LIMIT $4 OFFSET $5;
```

### Summary counts by plan

```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = 'active')::int AS active,
  COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
FROM plan_features
WHERE plan_id = $1;
```

### List by plan + status filter (`all|active|inactive`)

```sql
SELECT *
FROM plan_features
WHERE plan_id = $1
  AND ($2 = 'all' OR status = $2)
ORDER BY display_order ASC, plan_feature_id DESC;
```

## Organization Message Menu Permissions Query Pack (`/organization-message-menu-permissions`)

### List by token org

```sql
SELECT *
FROM organization_message_menu_permissions
WHERE organization_id = $1
ORDER BY permission_id DESC
LIMIT $2 OFFSET $3;
```

### Update permission (full/partial payload style)

```sql
UPDATE organization_message_menu_permissions
SET
  menu_item_id = COALESCE($1, menu_item_id),
  permission_type = COALESCE($2, permission_type),
  note = COALESCE($3, note),
  status = COALESCE($4, status),
  updated_at = NOW()
WHERE permission_id = $5
  AND organization_id = $6
RETURNING *;
```

## Site Details Query Pack (`/site-details`)

Current schema note:

- `site_details` no longer contains `organization_id`.
- child tables store multiple entries by `site_detail_id`.

### List all site details

```sql
SELECT *
FROM site_details
ORDER BY site_detail_id DESC;
```

### Fetch one site detail by id

```sql
SELECT *
FROM site_details
WHERE site_detail_id = $1
LIMIT 1;
```

### Fetch child records by site_detail_id

```sql
SELECT * FROM site_detail_emails WHERE site_detail_id = $1 ORDER BY site_detail_email_id ASC;
SELECT * FROM site_detail_phones WHERE site_detail_id = $1 ORDER BY site_detail_phone_id ASC;
SELECT * FROM site_detail_addresses WHERE site_detail_id = $1 ORDER BY site_detail_address_id ASC;
```

### Create site detail (master row)

```sql
INSERT INTO site_details (
  brand_name,
  logo_url,
  mascot_url,
  google_plus_url,
  linkedin_url,
  twitter_url,
  youtube_url,
  status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'active'))
RETURNING *;
```

### Update site detail by id (PUT/PATCH style)

```sql
UPDATE site_details
SET
  brand_name = COALESCE($1, brand_name),
  logo_url = COALESCE($2, logo_url),
  mascot_url = COALESCE($3, mascot_url),
  google_plus_url = COALESCE($4, google_plus_url),
  linkedin_url = COALESCE($5, linkedin_url),
  twitter_url = COALESCE($6, twitter_url),
  youtube_url = COALESCE($7, youtube_url),
  status = COALESCE($8, status),
  updated_at = NOW()
WHERE site_detail_id = $9
RETURNING *;
```

### Replace child records (transactional pattern)

```sql
DELETE FROM site_detail_emails WHERE site_detail_id = $1;
DELETE FROM site_detail_phones WHERE site_detail_id = $1;
DELETE FROM site_detail_addresses WHERE site_detail_id = $1;
```

### Full site-details reset (current production-safe utility)

```sql
TRUNCATE TABLE
  site_detail_addresses,
  site_detail_phones,
  site_detail_emails,
  site_details
RESTART IDENTITY;
```

## Product Features Query Pack (`/product-features`)

### Catalog query (`GET /product-features/catalog`)

```sql
SELECT
  fc.feature_category_id,
  fc.category_key,
  fc.category_label,
  fc.display_order AS category_display_order,
  fc.status AS category_status,
  fi.feature_item_id,
  fi.title,
  fi.description,
  fi.icon_url,
  fi.display_order AS item_display_order,
  fi.status AS item_status
FROM feature_categories fc
LEFT JOIN feature_items fi ON fi.feature_category_id = fc.feature_category_id
WHERE ($1::varchar IS NULL OR fc.status = $1)
  AND ($1::varchar IS NULL OR fi.status = $1 OR fi.feature_item_id IS NULL)
ORDER BY fc.display_order ASC, fc.feature_category_id ASC, fi.display_order ASC, fi.feature_item_id ASC;
```

### Category list query (`GET /product-features/categories`)

```sql
SELECT
  fc.*,
  COUNT(fi.feature_item_id)::int AS feature_count,
  COUNT(*) OVER() AS total_count
FROM feature_categories fc
LEFT JOIN feature_items fi ON fi.feature_category_id = fc.feature_category_id
WHERE ($1::varchar IS NULL OR fc.status = $1)
  AND (
    $2::varchar IS NULL
    OR fc.category_key ILIKE $2
    OR fc.category_label ILIKE $2
    OR CAST(fc.feature_category_id AS TEXT) ILIKE $2
  )
GROUP BY fc.feature_category_id
ORDER BY fc.display_order ASC, fc.feature_category_id ASC
LIMIT $3 OFFSET $4;
```

### Item list query (`GET /product-features`)

```sql
SELECT
  fi.*,
  fc.category_key,
  fc.category_label,
  COUNT(*) OVER() AS total_count
FROM feature_items fi
JOIN feature_categories fc ON fc.feature_category_id = fi.feature_category_id
WHERE ($1::bigint IS NULL OR fi.feature_category_id = $1)
  AND ($2::varchar IS NULL OR LOWER(fc.category_key) = LOWER($2))
  AND ($3::varchar IS NULL OR fi.status = $3)
  AND (
    $4::varchar IS NULL
    OR fi.title ILIKE $4
    OR COALESCE(fi.description, '') ILIKE $4
    OR COALESCE(fc.category_label, '') ILIKE $4
  )
ORDER BY fc.display_order ASC, fi.display_order ASC, fi.feature_item_id ASC
LIMIT $5 OFFSET $6;
```

### Create category (`POST /product-features/categories`)

```sql
INSERT INTO feature_categories (
  category_key,
  category_label,
  display_order,
  status
)
VALUES ($1, $2, COALESCE($3, 10), COALESCE($4, 'active'))
RETURNING *;
```

### Update category (`PUT/PATCH /product-features/categories/:categoryId`)

```sql
UPDATE feature_categories
SET
  category_key = COALESCE($1, category_key),
  category_label = COALESCE($2, category_label),
  display_order = COALESCE($3, display_order),
  status = COALESCE($4, status),
  updated_at = NOW()
WHERE feature_category_id = $5
RETURNING *;
```

### Create item (`POST /product-features`)

```sql
INSERT INTO feature_items (
  feature_category_id,
  title,
  description,
  icon_url,
  display_order,
  status
)
VALUES ($1, $2, $3, $4, COALESCE($5, 10), COALESCE($6, 'active'))
RETURNING *;
```

### Update item (`PUT/PATCH /product-features/:id`)

```sql
UPDATE feature_items
SET
  feature_category_id = COALESCE($1, feature_category_id),
  title = COALESCE($2, title),
  description = COALESCE($3, description),
  icon_url = COALESCE($4, icon_url),
  display_order = COALESCE($5, display_order),
  status = COALESCE($6, status),
  updated_at = NOW()
WHERE feature_item_id = $7
RETURNING *;
```

## Contact Us Query Pack (`/contact-us`)

Runtime mail note:

- `POST /contact-us` after DB insert triggers async emails:
  - admin notify -> `CONTACT_US_NOTIFY_TO`
  - customer acknowledgement -> `email_address`

### Create request

```sql
INSERT INTO contact_us_requests (
  name,
  country_code,
  mobile_number,
  email_address,
  company_name,
  total_users,
  requirement_details
)
VALUES ($1, COALESCE($2, '+91'), $3, $4, $5, $6, $7)
RETURNING *;
```

### List requests

```sql
SELECT
  *,
  COUNT(*) OVER() AS total_count
FROM contact_us_requests
WHERE ($1::varchar IS NULL OR status = $1)
  AND (
    $2::varchar IS NULL
    OR name ILIKE $2
    OR email_address ILIKE $2
    OR mobile_number ILIKE $2
    OR company_name ILIKE $2
    OR COALESCE(requirement_details, '') ILIKE $2
  )
ORDER BY contact_request_id DESC
LIMIT $3 OFFSET $4;
```

### Get one by id

```sql
SELECT *
FROM contact_us_requests
WHERE contact_request_id = $1
LIMIT 1;
```

## Organization Details API Query Pack (`GET /auth/organization-details`)

### 1) Organization + owner + language + timezone

```sql
SELECT
  o.organization_id,
  o.org_key,
  o.name,
  o.subdomain,
  o.custom_domain,
  o.owner_id,
  owner.name AS owner_name,
  owner.email AS owner_email,
  o.language_id,
  lang.language_code,
  lang.full_name AS language_name,
  o.timezone_id,
  tz.timezone_code,
  tz.display_name AS timezone_name,
  o.storage_used_mb,
  o.status,
  o.created_at,
  o.updated_at
FROM organizations o
LEFT JOIN users owner ON owner.user_id = o.owner_id
LEFT JOIN languages lang ON lang.language_id = o.language_id
LEFT JOIN timezones tz ON tz.timezone_id = o.timezone_id
WHERE o.organization_id = $1
LIMIT 1;
```

### 2) Current subscription + plan

```sql
SELECT
  s.subscription_id,
  s.organization_id,
  s.plan_id,
  s.status,
  s.start_date,
  s.end_date,
  s.max_users,
  s.max_storage_mb,
  p.plan_key,
  p.plan_name,
  p.interval_days,
  p.price
FROM subscriptions s
LEFT JOIN plans p ON p.plan_id = s.plan_id
WHERE s.organization_id = $1
ORDER BY s.created_at DESC
LIMIT 1;
```

### 3) Member counters

```sql
SELECT
  COUNT(*)::int AS total_members,
  COUNT(*) FILTER (WHERE om.status = 'active')::int AS active_members,
  COUNT(*) FILTER (WHERE om.status = 'invited')::int AS invited_members,
  COUNT(*) FILTER (WHERE om.status = 'suspended')::int AS suspended_members,
  COUNT(*) FILTER (WHERE om.status = 'left')::int AS left_members,
  COUNT(*) FILTER (WHERE u.is_global_member = TRUE)::int AS global_members,
  COUNT(*) FILTER (WHERE u.is_platform_admin = TRUE)::int AS platform_admin_members
FROM organization_members om
JOIN users u ON u.user_id = om.user_id
WHERE om.organization_id = $1;
```

### 4) Role distribution

```sql
SELECT
  r.role_id,
  r.role_key,
  r.role_name,
  COUNT(*)::int AS total
FROM organization_members om
LEFT JOIN roles r ON r.role_id = om.role_id
WHERE om.organization_id = $1
GROUP BY r.role_id, r.role_key, r.role_name
ORDER BY total DESC, r.role_id ASC;
```

### 5) Structure counts

```sql
SELECT
  (SELECT COUNT(*)::int FROM departments d WHERE d.organization_id = $1) AS departments,
  (SELECT COUNT(*)::int FROM designations ds WHERE ds.organization_id = $1) AS designations,
  (SELECT COUNT(*)::int FROM locations l WHERE l.organization_id = $1) AS locations;
```

## Profile API Query Pack (`GET /auth/me`)

### Profile counters in one query

```sql
SELECT
  (SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = $1) AS total_members,
  (SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = $1 AND om.status = 'active') AS active_members,
  (SELECT COUNT(*)::int FROM user_devices ud WHERE ud.user_id = $2) AS user_devices,
  (SELECT COUNT(*)::int FROM user_sessions us WHERE us.user_id = $2 AND us.organization_id = $1) AS user_sessions,
  (SELECT COUNT(*)::int FROM otp_verifications ov WHERE ov.user_id = $2 AND ov.organization_id = $1) AS otp_verifications,
  (SELECT COUNT(*)::int FROM global_access ga WHERE ga.org_id = $1 AND ga.user_id = $2 AND ga.status = 'active') AS global_access_allowed_users,
  (SELECT COUNT(*)::int FROM global_access ga WHERE ga.org_id = $1 AND ga.allow_user_id = $2 AND ga.status = 'active') AS global_access_received;
```

### Auth timeline feed (recent security events)

```sql
SELECT
  log_id,
  occurred_at,
  action,
  status,
  ip_address,
  user_agent
FROM activity_log
WHERE actor_id = $1
  AND context_organization_id = $2
  AND action LIKE 'auth.%'
ORDER BY occurred_at DESC
LIMIT $3;
```

### Trusted devices list (`GET /auth/trusted-devices`)

```sql
SELECT
  device_id,
  user_id,
  device_name,
  device_type,
  ip_address,
  user_agent,
  country,
  city,
  is_trusted,
  status,
  last_active_at
FROM user_devices
WHERE user_id = $1
  AND is_trusted = TRUE
ORDER BY last_active_at DESC
LIMIT $2 OFFSET $3;
```

### Trusted-device revoke (`POST /auth/trusted-devices/:deviceId/revoke`)

```sql
UPDATE user_devices
SET
  is_trusted = FALSE,
  updated_at = NOW()
WHERE user_id = $1
  AND device_id = $2
RETURNING device_id, is_trusted;
```

## Global Access Query Pack (`/global-access`)

### List mappings

```sql
SELECT
  ga.global_access_id,
  ga.org_id,
  ga.user_id,
  ga.allow_user_id,
  ga.status,
  ga.created_at,
  ga.updated_at
FROM global_access ga
WHERE ga.org_id = $1
ORDER BY ga.created_at DESC
LIMIT $2 OFFSET $3;
```

### Fetch allowed users by org + user

```sql
SELECT
  ga.org_id,
  ga.user_id,
  ga.allow_user_id,
  u.name AS allow_user_name,
  u.email AS allow_user_email,
  ga.status,
  ga.created_at,
  ga.updated_at
FROM global_access ga
JOIN users u ON u.user_id = ga.allow_user_id
WHERE ga.org_id = $1
  AND ga.user_id = $2
  AND ga.status = 'active'
ORDER BY u.name ASC, ga.allow_user_id ASC;
```

### Integrity check (cross-org guard)

```sql
SELECT ga.*
FROM global_access ga
LEFT JOIN organization_members om
  ON om.organization_id = ga.org_id
 AND om.user_id = ga.allow_user_id
WHERE om.membership_id IS NULL;
```

## Groups Query Pack (`/groups`, `/group-members`, `/group-timeline`)

### Create group

```sql
INSERT INTO groups (
  organization_id,
  group_name,
  group_description,
  group_image,
  created_by,
  is_airtime,
  status
)
VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), COALESCE($7, 'active'))
RETURNING *;
```

### List groups (paged)

```sql
SELECT
  g.*,
  u.name AS created_by_name,
  u.email AS created_by_email,
  (
    SELECT COUNT(*)::int
    FROM group_members gm
    WHERE gm.group_id = g.group_id
      AND gm.status = 'active'
  ) AS active_member_count
FROM groups g
LEFT JOIN users u ON u.user_id = g.created_by
WHERE g.organization_id = $1
ORDER BY g.group_id DESC
LIMIT $2 OFFSET $3;
```

### Create group member

```sql
INSERT INTO group_members (
  group_id,
  user_id,
  is_admin,
  organization_id,
  status
)
VALUES ($1, $2, COALESCE($3, FALSE), $4, COALESCE($5, 'active'))
RETURNING *;
```

### Verify user belongs to org (active membership)

```sql
SELECT membership_id
FROM organization_members
WHERE user_id = $1
  AND organization_id = $2
  AND status = 'active'
LIMIT 1;
```

### List members by group name

```sql
SELECT
  gm.group_member_id,
  gm.group_id,
  g.group_name,
  g.organization_id,
  gm.user_id,
  u.name,
  u.email,
  gm.is_admin,
  gm.status AS member_status
FROM group_members gm
JOIN groups g ON g.group_id = gm.group_id
JOIN users u ON u.user_id = gm.user_id
WHERE LOWER(g.group_name) = LOWER($1)
  AND g.organization_id = $2
  AND gm.status = $3
ORDER BY gm.group_member_id DESC
LIMIT $4 OFFSET $5;
```

### Write timeline event

```sql
INSERT INTO group_timeline (
  group_id,
  actor_user_id,
  target_user_id,
  event_type,
  event_description,
  organization_id,
  status
)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'visible'))
RETURNING *;
```

### List timeline events

```sql
SELECT
  gt.timeline_id,
  gt.group_id,
  gt.actor_user_id,
  actor.name AS actor_name,
  gt.target_user_id,
  target.name AS target_name,
  gt.event_type,
  gt.event_description,
  gt.organization_id,
  gt.event_at,
  gt.status
FROM group_timeline gt
LEFT JOIN users actor ON actor.user_id = gt.actor_user_id
LEFT JOIN users target ON target.user_id = gt.target_user_id
WHERE gt.organization_id = $1
  AND gt.group_id = $2
ORDER BY gt.event_at DESC, gt.timeline_id DESC
LIMIT $3 OFFSET $4;
```

### Integrity check: group-member org mismatch

```sql
SELECT
  gm.group_member_id,
  gm.group_id,
  gm.organization_id AS member_org_id,
  g.organization_id AS group_org_id
FROM group_members gm
JOIN groups g ON g.group_id = gm.group_id
WHERE gm.organization_id <> g.organization_id;
```

## Refresh Session Verification Queries

Use these to validate refresh lifecycle behavior.

```sql
-- Active sessions that are still refresh-eligible
SELECT
  session_id,
  user_id,
  organization_id,
  status,
  created_at,
  last_used_at,
  expires_at,
  revoked_at
FROM user_sessions
WHERE status = 'active'
  AND revoked_at IS NULL
  AND expires_at > NOW()
ORDER BY expires_at ASC;
```

```sql
-- Recently revoked/expired sessions
SELECT
  session_id,
  user_id,
  status,
  last_used_at,
  expires_at,
  revoked_at
FROM user_sessions
WHERE status IN ('revoked', 'expired')
ORDER BY COALESCE(revoked_at, expires_at) DESC
LIMIT 100;
```

```sql
-- Refresh action audit trail
SELECT
  log_id,
  actor_id,
  action,
  status,
  occurred_at,
  context_organization_id
FROM activity_log
WHERE action IN ('auth.refresh', 'auth.logout', 'auth.logout_all', 'auth.refresh_reuse_detected')
ORDER BY occurred_at DESC
LIMIT 100;
```

## Activity Log Debug Queries

### Latest org activity

```sql
SELECT
  log_id,
  occurred_at,
  actor_id,
  action,
  action_category,
  action_subtype,
  status
FROM activity_log
WHERE context_organization_id = $1
ORDER BY occurred_at DESC
LIMIT $2;
```

### Verify global-access logs

```sql
SELECT
  log_id,
  action,
  status,
  occurred_at,
  old_values,
  new_values
FROM activity_log
WHERE context_organization_id = $1
  AND action IN (
    'global_access.create',
    'global_access.update',
    'global_access.patch',
    'global_access.delete'
  )
ORDER BY occurred_at DESC
LIMIT 50;
```

## Reset Data (TRUNCATE + Auto Increment Reset)

Use this only for local/dev reset. It deletes all data from listed tables and resets sequences.

```sql
TRUNCATE TABLE
  otp_verifications,
  user_sessions,
  user_devices,
  organization_members,
  subscriptions,
  organizations,
  users
RESTART IDENTITY CASCADE;
```

Notes:

- `RESTART IDENTITY` resets auto-increment sequences to start from 1.
- `CASCADE` truncates dependent tables as needed.
- Keep master/lookup tables (`roles`, `plans`, `languages`, `timezones`) untouched unless intentionally reseeding them.

If you only want `users` and `organizations` reset:

```sql
TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE;
```

Manual sequence reset (only when needed):

```sql
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;
ALTER SEQUENCE organizations_organization_id_seq RESTART WITH 1;
```

## Groups Reset (TRUNCATE + Auto Increment Reset)

Use this for local/dev cleanup of group data.

### Option A: Reset only `group_members` (keep groups)

```sql
TRUNCATE TABLE group_members RESTART IDENTITY;
```

What it does:

- Deletes all rows from `group_members`
- Resets `group_members_group_member_id_seq` back to start value

### Option B: Reset full group module data (recommended for clean slate)

```sql
TRUNCATE TABLE
  group_timeline,
  group_permissions,
  group_members,
  groups
RESTART IDENTITY CASCADE;
```

What it does:

- Deletes all rows from group module tables
- Resets auto-increment sequences for:
  - `groups.group_id`
  - `group_members.group_member_id`
  - `group_permissions.permission_id`
  - `group_timeline.timeline_id`
- `CASCADE` handles dependent FK references safely

### Optional manual sequence reset (only if needed)

```sql
ALTER SEQUENCE groups_group_id_seq RESTART WITH 1;
ALTER SEQUENCE group_members_group_member_id_seq RESTART WITH 1;
ALTER SEQUENCE group_permissions_permission_id_seq RESTART WITH 1;
ALTER SEQUENCE group_timeline_timeline_id_seq RESTART WITH 1;
```

## Static Default Seed (User + Organization)

This is a static seed example with default member role and default plan subscription.

```sql

=BEGIN;

BHavesh@123

-- 1) Insert default user
INSERT INTO users (
  email,
  name,
  password_hash,
  mobile,
  is_platform_admin,
  is_global_member,
  status
)
VALUES (
  'owner@teamchatx.com',
  'Default Owner',
  '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqr',
  '+919999999999',
  FALSE,
  FALSE,
  'active'
)
RETURNING user_id;

-- assume returned user_id = 1

-- 2) Insert organization
INSERT INTO organizations (
  org_key,
  name,
  subdomain,
  custom_domain,
  owner_id,
  language_id,
  timezone_id,
  storage_used_mb,
  status
)
VALUES (
  'teamchatx_org_001',
  'Teamchatx',
  'teamchatx',
  'teamchatx.com',
  1,
  1,
  1,
  0,
  'active'
)
RETURNING organization_id;

-- assume returned organization_id = 1

-- 3) Insert member with default role_id = 3
INSERT INTO organization_members (
  organization_id,
  user_id,
  role_id,
  status
)
VALUES (1, 1, 1, 'active');

-- 4) Insert subscription with default plan_id = 1
--    end_date = start_date + interval_days
INSERT INTO subscriptions (
  organization_id,
  plan_id,
  status,
  start_date,
  end_date,
  max_users,
  max_storage_mb
)
SELECT
  1,
  p.plan_id,
  'active',
  CURRENT_DATE,
  CURRENT_DATE + (p.interval_days * INTERVAL '1 day'),
  p.max_users,
  p.max_storage_mb
FROM plans p
WHERE p.plan_id = 1;

COMMIT;

```

Prerequisites:

- `roles` table must contain `role_id = 3`.
- `plans` table must contain `plan_id = 1` with valid `interval_days`.

## Organization Restrictions Query Pack (`/organization-restrictions`)

### Create IP restriction

```sql
INSERT INTO organization_ip_restrictions (
  organization_id,
  ip_address,
  status,
  note
)
VALUES ($1, $2, COALESCE($3, 'active'), $4)
RETURNING *;
```

### IP list query

```sql
SELECT
  *,
  COUNT(*) OVER() AS total_count
FROM organization_ip_restrictions
WHERE organization_id = $1
  AND ($2::varchar IS NULL OR status = $2)
  AND (
    $3::varchar IS NULL
    OR ip_address ILIKE $3
    OR COALESCE(note, '') ILIKE $3
    OR CAST(restriction_id AS TEXT) ILIKE $3
  )
ORDER BY restriction_id DESC
LIMIT $4 OFFSET $5;
```

### Create platform restriction

```sql
INSERT INTO organization_platform_restrictions (
  organization_id,
  platform_id,
  restriction_type,
  status,
  note
)
VALUES ($1, $2, $3, COALESCE($4, 'active'), $5)
RETURNING *;
```

### Platform list query

```sql
SELECT
  opr.*,
  p.platform_key,
  p.platform_name,
  p.category AS platform_category,
  COUNT(*) OVER() AS total_count
FROM organization_platform_restrictions opr
LEFT JOIN platforms p ON p.platform_id = opr.platform_id
WHERE opr.organization_id = $1
  AND ($2::bigint IS NULL OR opr.platform_id = $2)
  AND ($3::varchar IS NULL OR opr.restriction_type = $3)
  AND ($4::varchar IS NULL OR opr.status = $4)
  AND (
    $5::varchar IS NULL
    OR COALESCE(p.platform_name, '') ILIKE $5
    OR COALESCE(p.platform_key, '') ILIKE $5
    OR COALESCE(opr.note, '') ILIKE $5
  )
ORDER BY opr.restriction_id DESC
LIMIT $6 OFFSET $7;
```

## Update Log (2026-02-25)

- Contact Us query pack kept in sync with latest API behavior.
- Product Features and Site Details query blocks reviewed for current schema.
- Added Organization Restrictions query pack for IP and Platform modules.

## Update Log (2026-03-09)

- Added query-pack alignment notes for billing APIs (per-user pricing, coupon validation, payment history reads).
- Added geo master lookup patterns (countries list and state-by-country list).
- Added coupon lookup/update query references used by owner-only coupon APIs.

## Update Log (2026-03-09, Docs Sync 2)

- Added billing-address query guidance:
  - fetch recent two active addresses by organization (`ORDER BY updated_at DESC LIMIT 2`)
  - dedupe lookup by full normalized address fields
  - set one default address per organization when selecting/reusing address
- Added coupon seed/upsert reference for `WELCOME30`:
  - `INSERT ... ON CONFLICT (coupon_code) DO UPDATE`



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

- When writing billing/debug SQL, include checks for:
  - `payment_history.invoice_number`
  - `payment_history.failure_reason`
  - `activity_log.action_category = 'billing'`
- Query examples should prefer `payment_id`, `transaction_id`, and `organization_id` over timestamp-derived invoice assumptions.

---

## Maintenance Queries

### Clear All Chat Data (Messages + Related)

Truncates all message tables, resets IDs. Use for dev/staging cleanup.

```sql
TRUNCATE
  messages,
  message_actions,
  message_files,
  group_messages,
  group_message_actions,
  group_message_files,
  group_message_recipients,
  group_message_reads,
  summary_cache
RESTART IDENTITY CASCADE;
```

### Clear All Group Data (Groups + Members + Messages + Timeline)

Truncates all group-related tables. Use for dev/staging cleanup.

```sql
TRUNCATE
  groups,
  group_members,
  group_messages,
  group_message_actions,
  group_message_files,
  group_message_recipients,
  group_message_reads,
  group_permissions,
  group_poll_options,
  group_poll_votes,
  group_polls,
  group_timeline
RESTART IDENTITY CASCADE;
```

### Clear Summary Cache Only

Remove cached AI summaries (regenerate on next click).

```sql
TRUNCATE summary_cache RESTART IDENTITY CASCADE;
```

### Clear AI Assistant Data

```sql
TRUNCATE
  assistant_conversations,
  assistant_feedback,
  assistant_usage,
  assistant_rate_limits
RESTART IDENTITY CASCADE;
```

### Clear Assistant Broadcasts & Knowledge Base

```sql
TRUNCATE
  assistant_broadcasts,
  assistant_knowledge
RESTART IDENTITY CASCADE;
```

### Reset User Sessions (Force All Logout)

```sql
UPDATE user_sessions SET status = 'revoked', revoked_at = NOW() WHERE status = 'active';
```

### Clear Activity Log

```sql
TRUNCATE activity_log RESTART IDENTITY CASCADE;
```
