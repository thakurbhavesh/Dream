# TeamChatX - Database Schema Overview

Last updated: 2026-03-19

Database: PostgreSQL
Table count: 60 (verified from `information_schema.tables`)
Architecture: Multi-tenant, global user support, role-based access, subscription-based, secure messaging platform

## Verified Base Tables (Live DB)

`public` schema tables (60):

```text
activity_log
ai_providers
assistant_broadcasts
assistant_conversations
assistant_feedback
assistant_knowledge
assistant_rate_limits
assistant_usage
billing_address_audit
billing_addresses
billing_checkout_sessions
contact_us_requests
countries
country_currency_priority
coupons
currencies
departments
designations
feature_categories
feature_items
global_access
group_members
group_message_actions
group_message_files
group_message_recipients
group_messages
group_permissions
group_poll_options
group_poll_votes
group_polls
group_timeline
groups
languages
locations
message_actions
message_files
message_menu_items
messages
organization_controls
organization_ip_restrictions
organization_members
organization_message_menu_permissions
organization_platform_restrictions
organizations
otp_verifications
payment_gateways
payment_history
plan_features
plans
platforms
roles
site_detail_addresses
site_detail_emails
site_detail_phones
site_details
smtp_settings
states
subscriptions
summary_cache
timezones
user_devices
user_sessions
users
```

---

## Complete Table & Column Reference

### Section 1: Lookup / Master Tables

#### roles
| Column | Type | Constraints |
|--------|------|-------------|
| role_id | BIGSERIAL | PRIMARY KEY |
| role_key | VARCHAR(50) | NOT NULL, UNIQUE |
| role_name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Role Mapping:** 1=owner, 2=admin, 3=moderator, 4=user

---

#### plans
| Column | Type | Constraints |
|--------|------|-------------|
| plan_id | BIGSERIAL | PRIMARY KEY |
| plan_key | VARCHAR(50) | NOT NULL, UNIQUE |
| plan_name | VARCHAR(100) | NOT NULL |
| price | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| default_currency | VARCHAR(3) | NOT NULL, DEFAULT 'INR', CHECK regex `^[A-Z]{3}$` |
| interval_days | INTEGER | NOT NULL |
| max_users | INTEGER | NOT NULL, DEFAULT 10 |
| max_storage_mb | BIGINT | NOT NULL, DEFAULT 500 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### plan_features
| Column | Type | Constraints |
|--------|------|-------------|
| plan_feature_id | BIGSERIAL | PRIMARY KEY |
| plan_id | BIGINT | NOT NULL, FK → plans(plan_id) ON DELETE CASCADE |
| feature_name | VARCHAR(255) | NOT NULL |
| feature_description | TEXT | |
| feature_icon | VARCHAR(100) | |
| section_label | VARCHAR(100) | NOT NULL, DEFAULT 'Plan Features' |
| display_order | SMALLINT | NOT NULL, DEFAULT 10 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (plan_id, feature_name)
**Indexes:** plan_id, status

---

#### feature_categories
| Column | Type | Constraints |
|--------|------|-------------|
| feature_category_id | BIGSERIAL | PRIMARY KEY |
| category_key | VARCHAR(60) | NOT NULL, UNIQUE |
| category_label | VARCHAR(100) | NOT NULL |
| display_order | SMALLINT | NOT NULL, DEFAULT 10 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (status, display_order, feature_category_id)

---

#### feature_items
| Column | Type | Constraints |
|--------|------|-------------|
| feature_item_id | BIGSERIAL | PRIMARY KEY |
| feature_category_id | BIGINT | NOT NULL, FK → feature_categories ON DELETE CASCADE |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| icon_url | TEXT | |
| display_order | SMALLINT | NOT NULL, DEFAULT 10 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (feature_category_id, title)
**Indexes:** feature_category_id, (status, display_order)

---

#### languages
| Column | Type | Constraints |
|--------|------|-------------|
| language_id | BIGSERIAL | PRIMARY KEY |
| language_code | VARCHAR(10) | NOT NULL, UNIQUE |
| full_name | VARCHAR(100) | NOT NULL |
| native_name | VARCHAR(100) | NOT NULL |
| direction | VARCHAR(3) | NOT NULL, DEFAULT 'ltr', CHECK ('ltr','rtl') |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### timezones
| Column | Type | Constraints |
|--------|------|-------------|
| timezone_id | BIGSERIAL | PRIMARY KEY |
| timezone_code | VARCHAR(50) | NOT NULL, UNIQUE |
| display_name | VARCHAR(100) | NOT NULL |
| utc_offset | VARCHAR(10) | NOT NULL |
| country_code | CHAR(2) | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### platforms
| Column | Type | Constraints |
|--------|------|-------------|
| platform_id | BIGSERIAL | PRIMARY KEY |
| platform_key | VARCHAR(80) | NOT NULL, UNIQUE |
| platform_name | VARCHAR(100) | NOT NULL |
| category | VARCHAR(20) | NOT NULL, DEFAULT 'other', CHECK ('browser','os','device','other') |
| icon_class | VARCHAR(100) | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### message_menu_items
| Column | Type | Constraints |
|--------|------|-------------|
| menu_item_id | BIGSERIAL | PRIMARY KEY |
| menu_key | VARCHAR(50) | NOT NULL, UNIQUE |
| label | VARCHAR(100) | NOT NULL |
| default_status | VARCHAR(20) | NOT NULL, DEFAULT 'show', CHECK ('show','hide','disable') |
| scope | VARCHAR(20) | NOT NULL, DEFAULT 'any', CHECK ('any','self','admin') |
| tone | VARCHAR(20) | DEFAULT 'normal', CHECK ('normal','danger','warning','info') |
| icon_class | VARCHAR(100) | |
| display_order | SMALLINT | NOT NULL, DEFAULT 10 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### countries
| Column | Type | Constraints |
|--------|------|-------------|
| country_id | BIGSERIAL | PRIMARY KEY |
| iso_code | VARCHAR(3) | NOT NULL, UNIQUE |
| name | VARCHAR(120) | NOT NULL |
| phonecode | VARCHAR(20) | |
| currency_code | VARCHAR(10) | |
| currency_name | VARCHAR(80) | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### states
| Column | Type | Constraints |
|--------|------|-------------|
| state_id | BIGSERIAL | PRIMARY KEY |
| country_id | BIGINT | NOT NULL, FK → countries ON DELETE CASCADE |
| iso_code | VARCHAR(20) | |
| name | VARCHAR(120) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (country_id, name)
**Indexes:** country_id, name

---

#### currencies
| Column | Type | Constraints |
|--------|------|-------------|
| currency_code | CHAR(3) | PRIMARY KEY |
| currency_name | VARCHAR(120) | NOT NULL |
| currency_symbol | VARCHAR(10) | |
| decimal_places | SMALLINT | NOT NULL, DEFAULT 2 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### country_currency_priority
| Column | Type | Constraints |
|--------|------|-------------|
| country_currency_priority_id | BIGSERIAL | PRIMARY KEY |
| country_iso_code | CHAR(2) | NOT NULL, FK → countries(iso_code) ON DELETE CASCADE |
| currency_code | CHAR(3) | NOT NULL, FK → currencies(currency_code) |
| rank_order | SMALLINT | NOT NULL, UNIQUE, CHECK > 0 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (country_iso_code)

---

#### coupons
| Column | Type | Constraints |
|--------|------|-------------|
| coupon_id | BIGSERIAL | PRIMARY KEY |
| coupon_code | VARCHAR(40) | NOT NULL, UNIQUE |
| coupon_name | VARCHAR(120) | |
| description | TEXT | |
| discount_type | VARCHAR(20) | NOT NULL, CHECK ('percent','fixed') |
| discount_value | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| currency_code | VARCHAR(10) | NOT NULL, DEFAULT 'USD' |
| max_discount_amount | DECIMAL(12,2) | |
| min_order_amount | DECIMAL(12,2) | |
| max_uses | INTEGER | |
| used_count | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 |
| valid_from | TIMESTAMPTZ | |
| valid_to | TIMESTAMPTZ | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** status, valid_to, UPPER(coupon_code)

---

### Section 2: Organization & Membership

#### organizations
| Column | Type | Constraints |
|--------|------|-------------|
| organization_id | BIGSERIAL | PRIMARY KEY |
| org_key | VARCHAR(80) | NOT NULL, UNIQUE |
| name | VARCHAR(150) | NOT NULL |
| subdomain | VARCHAR(100) | NOT NULL, UNIQUE |
| custom_domain | VARCHAR(255) | UNIQUE |
| owner_id | BIGINT | NOT NULL, FK → users ON DELETE RESTRICT |
| language_id | BIGINT | NOT NULL, DEFAULT 1, FK → languages |
| timezone_id | BIGINT | NOT NULL, DEFAULT 1, FK → timezones |
| logo_url | TEXT | |
| storage_used_mb | BIGINT | NOT NULL, DEFAULT 0 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','suspended','archived') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** owner_id, subdomain

---

#### organization_members
| Column | Type | Constraints |
|--------|------|-------------|
| membership_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users ON DELETE CASCADE |
| role_id | BIGINT | NOT NULL, FK → roles |
| department_id | BIGINT | FK → departments ON DELETE SET NULL |
| designation_id | BIGINT | FK → designations ON DELETE SET NULL |
| location_id | BIGINT | FK → locations ON DELETE SET NULL |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','invited','suspended','left') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, user_id)
**Indexes:** organization_id, user_id, status, department_id, designation_id, location_id

---

#### global_access
| Column | Type | Constraints |
|--------|------|-------------|
| global_access_id | BIGSERIAL | PRIMARY KEY |
| org_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users ON DELETE CASCADE |
| allow_user_id | BIGINT | NOT NULL, FK → users ON DELETE CASCADE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (org_id, user_id, allow_user_id)
**Check:** user_id <> allow_user_id

---

#### subscriptions
| Column | Type | Constraints |
|--------|------|-------------|
| subscription_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| plan_id | BIGINT | NOT NULL, FK → plans |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'active', CHECK ('active','trial','expired','cancelled','grace') |
| start_date | DATE | NOT NULL |
| end_date | DATE | |
| max_users | INTEGER | NOT NULL |
| max_storage_mb | BIGINT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** organization_id, status

---

#### payment_history
| Column | Type | Constraints |
|--------|------|-------------|
| payment_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| subscription_id | BIGINT | FK → subscriptions |
| plan_id | BIGINT | FK → plans |
| amount | DECIMAL(12,2) | NOT NULL |
| payment_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| payment_status | VARCHAR(30) | NOT NULL, DEFAULT 'pending', CHECK ('pending','success','failed','refunded') |
| invoice_number | VARCHAR(50) | NOT NULL, UNIQUE |
| transaction_id | VARCHAR(100) | UNIQUE (partial, WHERE NOT NULL) |
| payment_method | VARCHAR(50) | |
| currency_code | VARCHAR(10) | |
| period_months | INTEGER | NOT NULL, DEFAULT 1 |
| user_count | INTEGER | |
| billing_type | VARCHAR(20) | |
| coupon_code | VARCHAR(40) | |
| discount_amount | DECIMAL(12,2) | |
| country | VARCHAR(80) | |
| state | VARCHAR(120) | |
| city | VARCHAR(120) | |
| postal_code | VARCHAR(40) | |
| billing_name | VARCHAR(120) | |
| billing_email | VARCHAR(255) | |
| company_name | VARCHAR(160) | |
| address_line1 | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** organization_id, payment_date, currency_code, LOWER(billing_email)

---

#### billing_addresses
| Column | Type | Constraints |
|--------|------|-------------|
| billing_address_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| full_name | VARCHAR(120) | NOT NULL |
| company_name | VARCHAR(160) | |
| email | VARCHAR(255) | NOT NULL |
| mobile | VARCHAR(30) | |
| address_line1 | VARCHAR(255) | NOT NULL |
| address_line2 | VARCHAR(255) | |
| city | VARCHAR(100) | NOT NULL |
| state | VARCHAR(120) | |
| postal_code | VARCHAR(30) | |
| country | VARCHAR(100) | NOT NULL |
| country_id | BIGINT | |
| state_id | BIGINT | |
| is_default | BOOLEAN | NOT NULL, DEFAULT TRUE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id) WHERE is_default = TRUE
**Indexes:** organization_id, LOWER(email)

---

#### billing_address_audit
| Column | Type | Constraints |
|--------|------|-------------|
| billing_address_audit_id | BIGSERIAL | PRIMARY KEY |
| billing_address_id | BIGINT | FK → billing_addresses ON DELETE SET NULL |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| actor_user_id | BIGINT | FK → users ON DELETE SET NULL |
| action | VARCHAR(20) | NOT NULL, CHECK ('create','update') |
| payload | JSONB | NOT NULL, DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (organization_id, created_at DESC)

---

#### payment_gateways
| Column | Type | Constraints |
|--------|------|-------------|
| payment_gateway_id | BIGSERIAL | PRIMARY KEY |
| gateway_key | VARCHAR(50) | NOT NULL, UNIQUE |
| gateway_name | VARCHAR(100) | NOT NULL |
| provider | VARCHAR(100) | |
| is_enabled | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| display_order | INTEGER | NOT NULL, DEFAULT 0 |
| config_json | JSONB | NOT NULL, DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (is_enabled, status, display_order)

---

#### billing_checkout_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| checkout_id | BIGSERIAL | PRIMARY KEY |
| session_id | VARCHAR(191) | NOT NULL, UNIQUE |
| gateway | VARCHAR(30) | NOT NULL, CHECK ('stripe','paypal') |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| actor_user_id | BIGINT | FK → users |
| amount | NUMERIC(12,2) | |
| currency_code | VARCHAR(3) | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK ('pending','confirmed','failed','canceled') |
| metadata | JSONB | NOT NULL, DEFAULT '{}' |
| failure_reason | JSONB | |
| confirmed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (organization_id, status, created_at DESC), (gateway, status, created_at DESC)

---

#### site_details
| Column | Type | Constraints |
|--------|------|-------------|
| site_detail_id | BIGSERIAL | PRIMARY KEY |
| brand_name | VARCHAR(150) | NOT NULL |
| logo_url | TEXT | |
| mascot_url | TEXT | |
| google_plus_url | TEXT | |
| linkedin_url | TEXT | |
| twitter_url | TEXT | |
| youtube_url | TEXT | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### site_detail_emails
| Column | Type | Constraints |
|--------|------|-------------|
| site_detail_email_id | BIGSERIAL | PRIMARY KEY |
| site_detail_id | BIGINT | NOT NULL, FK → site_details ON DELETE CASCADE |
| email_address | VARCHAR(255) | NOT NULL |
| label | VARCHAR(50) | |
| is_primary | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (site_detail_id, email_address)

---

#### site_detail_phones
| Column | Type | Constraints |
|--------|------|-------------|
| site_detail_phone_id | BIGSERIAL | PRIMARY KEY |
| site_detail_id | BIGINT | NOT NULL, FK → site_details ON DELETE CASCADE |
| phone_number | VARCHAR(30) | NOT NULL |
| label | VARCHAR(50) | |
| is_primary | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (site_detail_id, phone_number)

---

#### site_detail_addresses
| Column | Type | Constraints |
|--------|------|-------------|
| site_detail_address_id | BIGSERIAL | PRIMARY KEY |
| site_detail_id | BIGINT | NOT NULL, FK → site_details ON DELETE CASCADE |
| label | VARCHAR(50) | |
| address_line_1 | VARCHAR(255) | NOT NULL |
| address_line_2 | VARCHAR(255) | |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| country | VARCHAR(100) | |
| postal_code | VARCHAR(20) | |
| is_primary | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### contact_us_requests
| Column | Type | Constraints |
|--------|------|-------------|
| contact_request_id | BIGSERIAL | PRIMARY KEY |
| name | VARCHAR(120) | NOT NULL |
| country_code | VARCHAR(10) | NOT NULL, DEFAULT '+91' |
| mobile_number | VARCHAR(30) | NOT NULL |
| email_address | VARCHAR(255) | NOT NULL |
| company_name | VARCHAR(150) | NOT NULL |
| total_users | INTEGER | NOT NULL, CHECK > 0 |
| requirement_details | TEXT | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'new', CHECK ('new','reviewed','closed') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** created_at DESC, status, LOWER(email_address), mobile_number

---

### Section 3: User & Security

#### users
| Column | Type | Constraints |
|--------|------|-------------|
| user_id | BIGSERIAL | PRIMARY KEY |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| name | VARCHAR(120) | NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| profile_url | TEXT | |
| mobile | VARCHAR(20) | |
| is_platform_admin | BOOLEAN | NOT NULL, DEFAULT FALSE |
| is_global_member | BOOLEAN | NOT NULL, DEFAULT FALSE |
| email_verified_at | TIMESTAMPTZ | |
| mobile_verified_at | TIMESTAMPTZ | |
| last_login_at | TIMESTAMPTZ | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','suspended','invited','archived') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** email, status, last_login_at

---

#### user_devices
| Column | Type | Constraints |
|--------|------|-------------|
| device_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL, FK → users ON DELETE CASCADE |
| device_name | VARCHAR(120) | |
| device_type | VARCHAR(20) | NOT NULL, DEFAULT 'other', CHECK ('mobile','desktop','tablet','other') |
| ip_address | VARCHAR(45) | NOT NULL |
| user_agent | TEXT | |
| latitude | DECIMAL(10,8) | |
| longitude | DECIMAL(11,8) | |
| accuracy_radius | INTEGER | |
| country | VARCHAR(100) | |
| city | VARCHAR(100) | |
| last_active_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| is_trusted | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','logged_out','suspicious','blocked') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** user_id, status, last_active_at

---

#### user_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| session_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL, FK → users ON DELETE CASCADE |
| organization_id | BIGINT | FK → organizations ON DELETE SET NULL |
| refresh_token_hash | VARCHAR(255) | NOT NULL |
| user_agent | TEXT | |
| ip_address | INET | |
| device_id | BIGINT | FK → user_devices ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| last_used_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','revoked','expired') |

**Indexes:** user_id, organization_id, status, expires_at, refresh_token_hash

---

#### otp_verifications
| Column | Type | Constraints |
|--------|------|-------------|
| otp_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | FK → users |
| organization_id | BIGINT | FK → organizations |
| identifier | VARCHAR(255) | NOT NULL |
| type | VARCHAR(10) | NOT NULL, CHECK ('email','phone') |
| otp_code | VARCHAR(6) | NOT NULL |
| purpose | VARCHAR(50) | NOT NULL, DEFAULT 'verification' |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK ('pending','verified','expired','failed') |
| attempt_count | SMALLINT | NOT NULL, DEFAULT 0 |
| max_attempts | SMALLINT | NOT NULL, DEFAULT 5 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| expires_at | TIMESTAMPTZ | NOT NULL |
| verified_at | TIMESTAMPTZ | |
| ip_address | VARCHAR(45) | |

**Indexes:** identifier, status, expires_at

---

#### smtp_settings
| Column | Type | Constraints |
|--------|------|-------------|
| smtp_settings_id | SERIAL | PRIMARY KEY |
| label | VARCHAR(255) | NOT NULL, DEFAULT 'Default' |
| host | VARCHAR(255) | NOT NULL, DEFAULT '' |
| port | INTEGER | NOT NULL, DEFAULT 587 |
| secure | BOOLEAN | NOT NULL, DEFAULT FALSE |
| smtp_user | VARCHAR(255) | NOT NULL, DEFAULT '' |
| smtp_pass | VARCHAR(255) | NOT NULL, DEFAULT '' |
| from_address | VARCHAR(255) | DEFAULT '' |
| contact_notify_to | TEXT | DEFAULT '' |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'inactive' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Note:** Created dynamically on startup via `smtpSettingsModel.createTableIfNotExists()`, not from a migration file. Only one row can have `status = 'active'` at a time (enforced in app logic).

---

### Section 4: Organization Controls & Restrictions

#### organization_controls
| Column | Type | Constraints |
|--------|------|-------------|
| control_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| feature_key | VARCHAR(50) | NOT NULL |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE |
| time_limit_minutes | INTEGER | |
| allowed_roles | JSONB | e.g. `{"user":true,"admin":true,"owner":true,"moderator":true}` |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, feature_key)
**Feature keys:** edit, delete, recall, away, idle, indicators

---

#### organization_ip_restrictions
| Column | Type | Constraints |
|--------|------|-------------|
| restriction_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| ip_address | VARCHAR(45) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| note | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, ip_address)

---

#### organization_platform_restrictions
| Column | Type | Constraints |
|--------|------|-------------|
| restriction_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| platform_id | BIGINT | NOT NULL, FK → platforms |
| restriction_type | VARCHAR(10) | NOT NULL, CHECK ('allow','block') |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| note | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, platform_id)

---

#### organization_message_menu_permissions
| Column | Type | Constraints |
|--------|------|-------------|
| permission_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| menu_item_id | BIGINT | NOT NULL, FK → message_menu_items |
| permission_type | VARCHAR(20) | NOT NULL, DEFAULT 'show', CHECK ('show','hide','disable') |
| note | TEXT | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

### Section 5: Organization Structure

#### departments
| Column | Type | Constraints |
|--------|------|-------------|
| department_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, name)

---

#### designations
| Column | Type | Constraints |
|--------|------|-------------|
| designation_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| department_id | BIGINT | NOT NULL, FK → departments ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (organization_id, department_id, name)

---

#### locations
| Column | Type | Constraints |
|--------|------|-------------|
| location_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| label | VARCHAR(100) | NOT NULL |
| country | VARCHAR(100) | NOT NULL, DEFAULT 'India' |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

### Section 6: Groups / Channels

#### groups
| Column | Type | Constraints |
|--------|------|-------------|
| group_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations ON DELETE CASCADE |
| group_name | VARCHAR(100) | NOT NULL |
| group_description | TEXT | |
| group_image | TEXT | |
| created_by | BIGINT | NOT NULL, FK → users |
| is_airtime | BOOLEAN | NOT NULL, DEFAULT FALSE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','inactive','archived','deleted') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** organization_id, status

---

#### group_members
| Column | Type | Constraints |
|--------|------|-------------|
| group_member_id | BIGSERIAL | PRIMARY KEY |
| group_id | BIGINT | NOT NULL, FK → groups ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users |
| is_admin | BOOLEAN | NOT NULL, DEFAULT FALSE |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','left','kicked','banned') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (group_id, user_id)
**Indexes:** group_id, user_id

---

#### group_permissions
| Column | Type | Constraints |
|--------|------|-------------|
| permission_id | BIGSERIAL | PRIMARY KEY |
| group_id | BIGINT | NOT NULL, FK → groups ON DELETE CASCADE |
| feature_key | VARCHAR(50) | NOT NULL |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE |
| allowed_roles | JSONB | |
| time_limit_minutes | INTEGER | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique:** (group_id, feature_key)

---

#### group_timeline
| Column | Type | Constraints |
|--------|------|-------------|
| timeline_id | BIGSERIAL | PRIMARY KEY |
| group_id | BIGINT | NOT NULL, FK → groups ON DELETE CASCADE |
| actor_user_id | BIGINT | NOT NULL, FK → users |
| target_user_id | BIGINT | FK → users |
| event_type | VARCHAR(50) | NOT NULL |
| event_description | TEXT | NOT NULL |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| event_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'visible', CHECK ('visible','hidden','deleted') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** group_id, event_at

---

### Section 7: Messaging (1:1 DM)

#### messages
| Column | Type | Constraints |
|--------|------|-------------|
| message_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| sender_id | BIGINT | NOT NULL, FK → users |
| receiver_id | BIGINT | NOT NULL, FK → users |
| message | TEXT | AES-256-GCM encrypted |
| message_type | VARCHAR(20) | NOT NULL, DEFAULT 'text', CHECK ('text','file','link','code','system','emoji','image','video','audio','poll') |
| message_metadata | JSONB | AES-256-GCM encrypted (stored as `{"_enc":"..."}`) |
| send_time | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| read_time | TIMESTAMPTZ | |
| edit_time | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (organization_id, sender_id, send_time DESC), (organization_id, receiver_id, send_time DESC), GIN(message) for FTS
**Migration 041:** Added 'emoji','image','video','audio' to message_type CHECK

---

#### message_files
| Column | Type | Constraints |
|--------|------|-------------|
| file_id | BIGSERIAL | PRIMARY KEY |
| message_id | BIGINT | NOT NULL, FK → messages ON DELETE CASCADE |
| file_name | VARCHAR(255) | NOT NULL |
| file_url | TEXT | NOT NULL (stores S3 key, signed on demand) |
| file_type | VARCHAR(255) | NOT NULL (MIME type, e.g. 'image/png') |
| file_size | BIGINT | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Migration 042:** Widened file_type from VARCHAR(50) to VARCHAR(255)

---

#### message_actions
| Column | Type | Constraints |
|--------|------|-------------|
| action_id | BIGSERIAL | PRIMARY KEY |
| message_id | BIGINT | NOT NULL, FK → messages ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users |
| action_type | VARCHAR(30) | NOT NULL (e.g. 'react:😊', 'delete', 'pin') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** message_id, user_id

---

### Section 8: Group Messages & Related Tables

#### group_messages
| Column | Type | Constraints |
|--------|------|-------------|
| group_message_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL, FK → organizations |
| group_id | BIGINT | NOT NULL, FK → groups ON DELETE CASCADE |
| sender_id | BIGINT | NOT NULL, FK → users |
| message_type | VARCHAR(20) | NOT NULL, DEFAULT 'text', CHECK ('text','file','link','code','system','emoji','image','video','audio','poll') |
| message | TEXT | AES-256-GCM encrypted |
| message_metadata | JSONB | AES-256-GCM encrypted |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** (group_id, created_at DESC), (organization_id, group_id, created_at DESC), GIN(message) for FTS
**Migration 041:** Added CHECK constraint with 'emoji','image','video','audio'

---

#### group_message_recipients
| Column | Type | Constraints |
|--------|------|-------------|
| recipient_id | BIGSERIAL | PRIMARY KEY |
| group_message_id | BIGINT | NOT NULL, FK → group_messages ON DELETE CASCADE |
| group_id | BIGINT | NOT NULL, FK → groups |
| user_id | BIGINT | NOT NULL, FK → users |
| delivery_status | VARCHAR(20) | NOT NULL, DEFAULT 'sent', CHECK ('sent','delivered','read') |
| delivered_at | TIMESTAMPTZ | |
| read_at | TIMESTAMPTZ | |

**Unique:** (group_message_id, user_id)
**Indexes:** group_message_id, user_id

---

#### group_message_reads
| Column | Type | Constraints |
|--------|------|-------------|
| read_id | BIGSERIAL | PRIMARY KEY |
| group_message_id | BIGINT | NOT NULL |
| user_id | BIGINT | NOT NULL |
| read_at | TIMESTAMPTZ | DEFAULT NOW() |

**Unique:** (group_message_id, user_id)
**Index:** `idx_gmr_message_user` on (group_message_id, user_id)

---

#### group_message_files
| Column | Type | Constraints |
|--------|------|-------------|
| file_id | BIGSERIAL | PRIMARY KEY |
| group_message_id | BIGINT | NOT NULL, FK → group_messages ON DELETE CASCADE |
| file_name | VARCHAR(255) | NOT NULL |
| file_url | TEXT | NOT NULL (stores S3 key, signed on demand) |
| file_type | VARCHAR(255) | NOT NULL (MIME type) |
| file_size | BIGINT | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Migration 042:** Widened file_type from VARCHAR(50) to VARCHAR(255)

---

#### group_message_actions
| Column | Type | Constraints |
|--------|------|-------------|
| action_id | BIGSERIAL | PRIMARY KEY |
| group_message_id | BIGINT | NOT NULL, FK → group_messages ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users |
| action_type | VARCHAR(30) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** group_message_id, user_id

---

### Section 9: Group Polls & Voting

#### group_polls
| Column | Type | Constraints |
|--------|------|-------------|
| poll_id | BIGSERIAL | PRIMARY KEY |
| group_message_id | BIGINT | NOT NULL, FK → group_messages ON DELETE CASCADE |
| group_id | BIGINT | NOT NULL, FK → groups |
| question | TEXT | NOT NULL |
| poll_type | VARCHAR(20) | NOT NULL, DEFAULT 'single', CHECK ('single','multiple') |
| show_results_before_vote | BOOLEAN | NOT NULL, DEFAULT FALSE |
| ends_at | TIMESTAMPTZ | |
| end_permission | VARCHAR(30) | NOT NULL, DEFAULT 'creator_admin', CHECK ('creator_only','creator_admin','admin') |
| created_by | BIGINT | NOT NULL, FK → users |
| ended_by | BIGINT | FK → users |
| ended_at | TIMESTAMPTZ | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','ended','deleted') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

#### group_poll_options
| Column | Type | Constraints |
|--------|------|-------------|
| option_id | BIGSERIAL | PRIMARY KEY |
| poll_id | BIGINT | NOT NULL, FK → group_polls ON DELETE CASCADE |
| option_text | TEXT | NOT NULL |
| vote_count | INTEGER | NOT NULL, DEFAULT 0 |
| order_no | SMALLINT | NOT NULL, DEFAULT 1 |

---

#### group_poll_votes
| Column | Type | Constraints |
|--------|------|-------------|
| vote_id | BIGSERIAL | PRIMARY KEY |
| poll_id | BIGINT | NOT NULL, FK → group_polls ON DELETE CASCADE |
| option_id | BIGINT | NOT NULL, FK → group_poll_options ON DELETE CASCADE |
| user_id | BIGINT | NOT NULL, FK → users |
| voted_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active','removed') |

**Unique (partial):** (poll_id, user_id, option_id) WHERE status = 'active'
**Indexes:** poll_id, user_id, (poll_id, status)

---

### Section 10: Activity Log

#### activity_log
| Column | Type | Constraints |
|--------|------|-------------|
| log_id | BIGSERIAL | PRIMARY KEY |
| actor_id | BIGINT | NOT NULL, FK → users ON DELETE SET NULL |
| actor_role_key | VARCHAR(50) | NOT NULL |
| context_organization_id | BIGINT | FK → organizations ON DELETE SET NULL |
| target_type | VARCHAR(40) | NOT NULL |
| target_id | BIGINT | |
| action | VARCHAR(60) | NOT NULL |
| action_category | VARCHAR(30) | NOT NULL |
| action_subtype | VARCHAR(60) | |
| description | TEXT | |
| old_values | JSONB | |
| new_values | JSONB | |
| ip_address | INET | |
| user_agent | TEXT | |
| occurred_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| is_successful | BOOLEAN | NOT NULL, DEFAULT TRUE |
| status | VARCHAR(20) | DEFAULT 'success', CHECK ('success','failed','denied') |

**Indexes:** (context_organization_id, occurred_at DESC), (actor_id, occurred_at DESC), (target_type, target_id), action, (occurred_at DESC)

---

## Encryption Notes

- Messages (`messages.message`, `group_messages.message`) are encrypted with AES-256-GCM before INSERT, decrypted after SELECT.
- Metadata (`message_metadata`) is encrypted as `{"_enc": "iv.ciphertext.tag"}` JSONB format.
- Requires env: `CHAT_ENCRYPTION_KEY` (64-char hex = 32 bytes).
- File URLs stored as S3 keys in DB, signed with presigned URLs on demand (not stored signed).

## Session TTL Mapping

- `JWT_EXPIRES_IN=15m` → access JWT claim expiry
- `JWT_REFRESH_EXPIRES_IN=90d` → session/refresh expiry window
- `OTP_RESEND_COOLDOWN_SECONDS=60` → minimum gap between OTP calls
- `OTP_LOCK_WINDOW_MINUTES=1` → temporary lock after max failed OTP attempts
- `REFRESH_REUSE_GRACE_SECONDS=5` → grace window for concurrent refresh rotation

## Applied Migrations (Latest)

| Migration | Description |
|-----------|-------------|
| 040_organization_controls.sql | Added organization_controls table |
| 041_message_type_add_emoji_image_video_audio.sql | Expanded message_type CHECK to include emoji, image, video, audio |
| 042_widen_file_type_column.sql | Widened file_type from VARCHAR(50) to VARCHAR(255) in message_files & group_message_files |
| 045_messages_delivered_at.sql | Added delivered_at column for DM delivery status tracking |
| 047_ai_providers.sql | AI providers table (Gemini/OpenAI/Claude) with dynamic config |
| 050_assistant_tables.sql | assistant_feedback, assistant_conversations, assistant_usage tables |
| 055_assistant_enhancements.sql | assistant_broadcasts, assistant_knowledge, assistant_rate_limits tables |

---

## AI Assistant Tables (New)

### ai_providers
| Column | Type | Constraints |
|--------|------|-------------|
| provider_id | BIGSERIAL | PRIMARY KEY |
| provider_key | VARCHAR(50) | NOT NULL, UNIQUE |
| display_name | VARCHAR(100) | NOT NULL |
| api_key | TEXT | |
| model | VARCHAR(100) | |
| is_active | BOOLEAN | DEFAULT false |
| status | VARCHAR(20) | DEFAULT 'inactive' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Seeded with: gemini (active), openai, anthropic.

### assistant_feedback
| Column | Type | Constraints |
|--------|------|-------------|
| feedback_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL |
| message_text | TEXT | |
| response_text | TEXT | |
| rating | VARCHAR(10) | NOT NULL (up/down) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Index: `(user_id, created_at DESC)`

### assistant_conversations
| Column | Type | Constraints |
|--------|------|-------------|
| conversation_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL |
| org_id | BIGINT | |
| title | VARCHAR(255) | |
| messages | JSONB | |
| message_count | INT | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Index: `(user_id, updated_at DESC)`

### assistant_usage
| Column | Type | Constraints |
|--------|------|-------------|
| usage_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL |
| org_id | BIGINT | |
| question_count | INT | DEFAULT 0 |
| avg_response_ms | INT | DEFAULT 0 |
| date | DATE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Unique: `(user_id, org_id, date)` for daily upsert.

### assistant_broadcasts
| Column | Type | Constraints |
|--------|------|-------------|
| broadcast_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL |
| message | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT true |
| priority | VARCHAR(20) | DEFAULT 'normal' (normal/high/urgent) |
| created_by | BIGINT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| expires_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Index: `(organization_id) WHERE is_active = true`

### assistant_knowledge
| Column | Type | Constraints |
|--------|------|-------------|
| knowledge_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| content | TEXT | NOT NULL |
| category | VARCHAR(100) | DEFAULT 'general' |
| is_active | BOOLEAN | DEFAULT true |
| created_by | BIGINT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Index: `(organization_id) WHERE is_active = true`

### assistant_rate_limits
| Column | Type | Constraints |
|--------|------|-------------|
| rate_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL |
| organization_id | BIGINT | |
| window_start | TIMESTAMPTZ | DEFAULT NOW() |
| request_count | INT | DEFAULT 1 |

Unique: `(user_id, organization_id)`. Sliding window: 50 requests/hour per user.

### summary_cache
| Column | Type | Constraints |
|--------|------|-------------|
| cache_id | BIGSERIAL | PRIMARY KEY |
| cache_key | VARCHAR(64) | NOT NULL, UNIQUE |
| summary | TEXT | |
| provider | VARCHAR(50) | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

SHA-256 hash of `(fileKey || fileUrl || text) + fileName` as cache key.

---

## Added 2026-04-14

### push_subscriptions
Web Push (VAPID) subscription store used by the service worker for background
notifications.

| Column | Type | Constraints |
|--------|------|-------------|
| subscription_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| endpoint | TEXT | NOT NULL, UNIQUE |
| p256dh | TEXT | NOT NULL |
| auth | TEXT | NOT NULL |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| last_used_at | TIMESTAMPTZ | DEFAULT NOW() |

Indexes: unique `(endpoint)`, `(user_id)`.

### meeting_guests
External guests invited to a meeting by email. Token goes in the URL, code is
typed by the guest, guest JWT is issued server-side on successful verify.

| Column | Type | Constraints |
|--------|------|-------------|
| guest_id | BIGSERIAL | PRIMARY KEY |
| meeting_id | BIGINT | NOT NULL REFERENCES meetings(id) ON DELETE CASCADE |
| email | VARCHAR(255) | NOT NULL |
| display_name | VARCHAR(255) | |
| access_token | VARCHAR(64) | NOT NULL, UNIQUE |
| access_code | VARCHAR(12) | NOT NULL |
| invited_by | BIGINT | REFERENCES users(user_id) ON DELETE SET NULL |
| invited_at | TIMESTAMPTZ | DEFAULT NOW() |
| joined_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | |

Indexes: unique `(meeting_id, email)`, `(access_token)`.

### call_logs
Dedicated audio/video call history, written alongside the DM call-log text
message from `socket.logCall`.

| Column | Type | Constraints |
|--------|------|-------------|
| call_log_id | BIGSERIAL | PRIMARY KEY |
| organization_id | BIGINT | NOT NULL |
| caller_id | BIGINT | NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| callee_id | BIGINT | NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| call_type | VARCHAR(16) | NOT NULL DEFAULT 'audio' |
| outcome | VARCHAR(24) | NOT NULL (`missed` / `declined` / `no_answer` / `offline` / `answered`) |
| started_at | TIMESTAMPTZ | DEFAULT NOW() |
| ended_at | TIMESTAMPTZ | |
| duration_seconds | INTEGER | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Indexes: `(caller_id, created_at DESC)`, `(callee_id, created_at DESC)`, `(organization_id, created_at DESC)`.

### user_thread_pins
Per-user pinned chat threads. Soft cap of 20 enforced at the model layer.

| Column | Type | Constraints |
|--------|------|-------------|
| pin_id | BIGSERIAL | PRIMARY KEY |
| user_id | BIGINT | NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| organization_id | BIGINT | NOT NULL |
| thread_id | VARCHAR(50) | NOT NULL |
| pinned_at | TIMESTAMPTZ | DEFAULT NOW() |

Indexes: unique `(user_id, organization_id, thread_id)`, `(user_id, organization_id)`.
