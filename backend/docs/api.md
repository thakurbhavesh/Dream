# TeamChatX API Handbook

Last updated: 2026-03-19

## Basics

- Base URL: `http://localhost:5000`
- Default content type: `application/json`
- Auth header:

```text
Authorization: Bearer <access_token>
```

- Success response:

```json
{
  "status": "success",
  "message": "Human readable message",
  "data": {}
}
```

- Error response:

```json
{
  "status": "error",
  "message": "Human readable message",
  "errors": null
}
```

## Auth And CSRF

- `GET`, `HEAD`, `OPTIONS` requests do not need CSRF.
- Public mutation routes like `/auth/login`, `/auth/register`, `/contact-us` do not need CSRF.
- Authenticated mutation routes can require `X-CSRF-Token` if auth cookies are present.
- If you use cookie-based auth in cURL, first call `GET /auth/csrf`, store cookies, then send `X-CSRF-Token`.

## Access Legend

- `Public`: no auth required
- `JWT`: valid authenticated user required
- `Owner`: JWT required and owner-only route
- `Blocked role 4`: JWT required, but `role_id = 4` denied

## cURL Setup

```bash
export BASE_URL="http://localhost:5000"
export TOKEN="your_access_token"
export CSRF_TOKEN="your_csrf_token"
```

Authenticated request template:

```bash
curl "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

Authenticated mutation template:

```bash
curl -X POST "$BASE_URL/example" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{}'
```

## Endpoint Inventory

### Health

Access: `Public`

| Method | Endpoint    | Access     |
| ------ | ----------- | ---------- |
| GET    | `/health` | `Public` |

### Auth

| Method | Endpoint                                                                      | Access             |
| ------ | ----------------------------------------------------------------------------- | ------------------ |
| POST   | `/auth/register`                                                            | `Public`         |
| POST   | `/auth/create-account`                                                      | `Public`         |
| POST   | `/auth/resend-otp`                                                          | `Public`         |
| POST   | `/auth/forgot-password`                                                     | `Public`         |
| POST   | `/auth/reset-password`                                                      | `Public`         |
| POST   | `/auth/forgot-verify`                                                       | `Public`         |
| POST   | `/auth/change-password`                                                     | `JWT`            |
| POST   | `/auth/verify-otp`                                                          | `Public`         |
| POST   | `/auth/login`                                                               | `Public`         |
| GET    | `/auth/csrf`                                                                | `Public`         |
| POST   | `/auth/refresh`                                                             | `Public`         |
| POST   | `/auth/logout`                                                              | `JWT`            |
| POST   | `/auth/logout-all`                                                          | `JWT`            |
| GET    | `/auth/trusted-devices`                                                     | `JWT`            |
| POST   | `/auth/trusted-devices/:deviceId/revoke`                                    | `JWT`            |
| GET    | `/auth/me`                                                                  | `JWT`            |
| GET    | `/auth/owner-dashboard`                                                     | `Owner`          |
| GET    | `/auth/owner-organizations/:organizationId/members`                         | `Owner`          |
| GET    | `/auth/owner-organizations/:organizationId/subscription`                    | `Owner`          |
| GET    | `/auth/owner-organizations/:organizationId/payment-history`                 | `Owner`          |
| GET    | `/auth/owner/v1/organizations`                                              | `Owner`          |
| GET    | `/auth/owner/v1/organizations/:organizationId/overview`                     | `Owner`          |
| PATCH  | `/auth/owner/v1/organizations/:organizationId/members/:userId`              | `Owner`          |
| POST   | `/auth/owner/v1/organizations/:organizationId/payments/:paymentId/complete` | `Owner`          |
| POST   | `/auth/owner/v1/owners`                                                     | `Owner`          |
| GET    | `/auth/user-details`                                                        | `Blocked role 4` |
| POST   | `/auth/user-details`                                                        | `Blocked role 4` |
| GET    | `/auth/organization-details`                                                | `Blocked role 4` |

### Owner v1 APIs

Access: `Owner` (platform owner only)

#### List Organizations

- Method/Path: `GET /auth/owner/v1/organizations`
- Query:
  - `limit` (optional, default `20`, max `100`)
  - `offset` (optional, default `0`)
  - `search` (optional)
- Response data:
  - `count`
  - `rows[]` with organization, owner, latest plan, and member stats

#### Organization Overview (Org + Members + Subscription + Payments)

- Method/Path: `GET /auth/owner/v1/organizations/:organizationId/overview`
- Query:
  - `members_limit` (optional, default `200`, max `2000`)
  - `members_offset` (optional, default `0`)
  - `members_search` (optional)
  - `payments_limit` (optional, default `20`, max `100`)
  - `payments_offset` (optional, default `0`)
  - `payments_search` (optional)
  - `payments_status` (optional)
- Response data:
  - `organization`
  - `members: { count, rows, meta }`
  - `subscription`
  - `payments: { count, rows, meta }`

#### Update Organization Member (Role/Status)

- Method/Path: `PATCH /auth/owner/v1/organizations/:organizationId/members/:userId`
- Body:

```json
{
  "role_id": 3,
  "membership_status": "active"
}
```

- Notes:
  - Send at least one field.
  - `membership_status` allowed: `active`, `invited`, `suspended`, `left`.

#### Owner Complete Payment (Manual Recovery)

- Method/Path: `POST /auth/owner/v1/organizations/:organizationId/payments/:paymentId/complete`
- Purpose:
  - Owner can complete a pending/failed payment on behalf of an organization.
  - Subscription is updated in same transaction and payment row is marked `success`.
- Body (example):

```json
{
  "gateway": "stripe",
  "plan_id": 2,
  "amount": 999,
  "user_count": 12,
  "transaction_id": "owner-manual-20260311-001",
  "billing_type": "renewal",
  "period_months": 1,
  "note": "Recovered after user payment failure"
}
```

- Notes:
  - `gateway` and `transaction_id` are recommended for audit clarity.
  - Optional: `plan_id`, `amount` (or `price`), `user_count` can be sent to override payment context.
  - If payment is already `success`, API returns existing success context.
  - `refunded` payments are blocked from re-completion.

#### Create New Owner + Organization

- Method/Path: `POST /auth/owner/v1/owners`
- Body:

```json
{
  "company_name": "Acme Technologies",
  "owner_name": "Jane Doe",
  "email": "jane@acme.com",
  "phone": "9876543210",
  "password": "StrongPass123!",
  "subdomain": "acme",
  "custom_domain": "acme.com",
  "plan_id": 1
}
```

- Behavior:
  - Creates owner user
  - Creates organization
  - Adds owner in `organization_members`
  - Creates active subscription from selected plan

### Users

| Method | Endpoint                     | Access             |
| ------ | ---------------------------- | ------------------ |
| POST   | `/users/forgot-password`   | `Public`         |
| POST   | `/users/forgot-verify`     | `Public`         |
| GET    | `/users`                   | `Blocked role 4` |
| POST   | `/users`                   | `Blocked role 4` |
| PATCH  | `/users/bulk`              | `Blocked role 4` |
| POST   | `/users/reset-password`    | `Blocked role 4` |
| GET    | `/users/:id`               | `Blocked role 4` |
| PUT    | `/users/:id`               | `Blocked role 4` |
| PATCH  | `/users/:id`               | `Blocked role 4` |
| DELETE | `/users/:id`               | `Blocked role 4` |
| PATCH  | `/users/:id/deactivate`    | `Blocked role 4` |
| PATCH  | `/users/:id/activate`      | `Blocked role 4` |
| POST   | `/users/:id/resend-invite` | `Blocked role 4` |

### Global Access

Read access: `JWT`

Write access: `Blocked role 4`

| Method | Endpoint                         | Access             |
| ------ | -------------------------------- | ------------------ |
| GET    | `/global-access`               | `JWT`            |
| POST   | `/global-access`               | `Blocked role 4` |
| GET    | `/global-access/allowed-users` | `JWT`            |
| GET    | `/global-access/:id`           | `JWT`            |
| PUT    | `/global-access/:id`           | `Blocked role 4` |
| PATCH  | `/global-access/:id`           | `Blocked role 4` |
| DELETE | `/global-access/:id`           | `Blocked role 4` |

### Departments

Access: `Blocked role 4`

| Method | Endpoint             | Access             |
| ------ | -------------------- | ------------------ |
| GET    | `/departments`     | `Blocked role 4` |
| POST   | `/departments`     | `Blocked role 4` |
| GET    | `/departments/:id` | `Blocked role 4` |
| PUT    | `/departments/:id` | `Blocked role 4` |
| PATCH  | `/departments/:id` | `Blocked role 4` |
| DELETE | `/departments/:id` | `Blocked role 4` |

### Designations

Access: `Blocked role 4`

| Method | Endpoint              | Access             |
| ------ | --------------------- | ------------------ |
| GET    | `/designations`     | `Blocked role 4` |
| POST   | `/designations`     | `Blocked role 4` |
| GET    | `/designations/:id` | `Blocked role 4` |
| PUT    | `/designations/:id` | `Blocked role 4` |
| PATCH  | `/designations/:id` | `Blocked role 4` |
| DELETE | `/designations/:id` | `Blocked role 4` |

### Locations

Access: `Blocked role 4`

| Method | Endpoint           | Access             |
| ------ | ------------------ | ------------------ |
| GET    | `/locations`     | `Blocked role 4` |
| POST   | `/locations`     | `Blocked role 4` |
| GET    | `/locations/:id` | `Blocked role 4` |
| PUT    | `/locations/:id` | `Blocked role 4` |
| PATCH  | `/locations/:id` | `Blocked role 4` |
| DELETE | `/locations/:id` | `Blocked role 4` |

### Master Resources

#### Roles

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint       |
| ------ | -------------- |
| GET    | `/roles`     |
| POST   | `/roles`     |
| GET    | `/roles/:id` |
| PUT    | `/roles/:id` |
| PATCH  | `/roles/:id` |
| DELETE | `/roles/:id` |

#### Plans

Access: `GET` = `Public`, write routes = `Owner`

| Method | Endpoint       |
| ------ | -------------- |
| GET    | `/plans`     |
| POST   | `/plans`     |
| GET    | `/plans/:id` |
| PUT    | `/plans/:id` |
| PATCH  | `/plans/:id` |
| DELETE | `/plans/:id` |

#### Languages

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint           |
| ------ | ------------------ |
| GET    | `/languages`     |
| POST   | `/languages`     |
| GET    | `/languages/:id` |
| PUT    | `/languages/:id` |
| PATCH  | `/languages/:id` |
| DELETE | `/languages/:id` |

#### Timezones

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint           |
| ------ | ------------------ |
| GET    | `/timezones`     |
| POST   | `/timezones`     |
| GET    | `/timezones/:id` |
| PUT    | `/timezones/:id` |
| PATCH  | `/timezones/:id` |
| DELETE | `/timezones/:id` |

#### Platforms

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint           |
| ------ | ------------------ |
| GET    | `/platforms`     |
| POST   | `/platforms`     |
| GET    | `/platforms/:id` |
| PUT    | `/platforms/:id` |
| PATCH  | `/platforms/:id` |
| DELETE | `/platforms/:id` |

#### Message Menu Items

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint                    |
| ------ | --------------------------- |
| GET    | `/message-menu-items`     |
| POST   | `/message-menu-items`     |
| GET    | `/message-menu-items/:id` |
| PUT    | `/message-menu-items/:id` |
| PATCH  | `/message-menu-items/:id` |
| DELETE | `/message-menu-items/:id` |

### Activity Logs

Access: `Blocked role 4`

| Method | Endpoint           |
| ------ | ------------------ |
| GET    | `/activity-logs` |

### Groups

Access: `GET` = `JWT`, write routes = `Blocked role 4`

| Method | Endpoint        |
| ------ | --------------- |
| GET    | `/groups`     |
| POST   | `/groups`     |
| GET    | `/groups/:id` |
| PUT    | `/groups/:id` |
| PATCH  | `/groups/:id` |

### Group Members

Access: `GET` = `JWT`, write routes = `Blocked role 4`

| Method | Endpoint                         |
| ------ | -------------------------------- |
| GET    | `/group-members`               |
| POST   | `/group-members`               |
| GET    | `/group-members/by-group-name` |
| GET    | `/group-members/:id`           |
| PUT    | `/group-members/:id`           |
| PATCH  | `/group-members/:id`           |

### Group Timeline

Access: `JWT`

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | `/group-timeline` |

### Organization Message Menu Permissions

Access: `Blocked role 4`

| Method | Endpoint                                       |
| ------ | ---------------------------------------------- |
| GET    | `/organization-message-menu-permissions`     |
| POST   | `/organization-message-menu-permissions`     |
| GET    | `/organization-message-menu-permissions/:id` |
| PUT    | `/organization-message-menu-permissions/:id` |
| PATCH  | `/organization-message-menu-permissions/:id` |

### Plan Features

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint                                |
| ------ | --------------------------------------- |
| GET    | `/plan-features/plan/:planId/summary` |
| GET    | `/plan-features`                      |
| POST   | `/plan-features`                      |
| GET    | `/plan-features/:id`                  |
| PUT    | `/plan-features/:id`                  |
| PATCH  | `/plan-features/:id`                  |

### Site Details

Access: `GET` = `Public`, write routes = `Owner`

| Method | Endpoint              |
| ------ | --------------------- |
| GET    | `/site-details`     |
| POST   | `/site-details`     |
| GET    | `/site-details/:id` |
| PUT    | `/site-details/:id` |
| PATCH  | `/site-details/:id` |

### Product Features

Access: `GET` = `Public`, write routes = `Owner`

| Method | Endpoint                                     |
| ------ | -------------------------------------------- |
| GET    | `/product-features/catalog`                |
| GET    | `/product-features/categories`             |
| POST   | `/product-features/categories`             |
| GET    | `/product-features/categories/:categoryId` |
| PUT    | `/product-features/categories/:categoryId` |
| PATCH  | `/product-features/categories/:categoryId` |
| GET    | `/product-features`                        |
| POST   | `/product-features`                        |
| GET    | `/product-features/:id`                    |
| PUT    | `/product-features/:id`                    |
| PATCH  | `/product-features/:id`                    |

### Contact Us

Access: `POST` = `Public`, `GET` = `Blocked role 4`

| Method | Endpoint            |
| ------ | ------------------- |
| POST   | `/contact-us`     |
| GET    | `/contact-us`     |
| GET    | `/contact-us/:id` |

### Organization Restrictions

Access: `GET` = `JWT`, write routes = `Blocked role 4`

| Method | Endpoint                                    |
| ------ | ------------------------------------------- |
| GET    | `/organization-restrictions/ip`           |
| POST   | `/organization-restrictions/ip`           |
| GET    | `/organization-restrictions/ip/:id`       |
| PUT    | `/organization-restrictions/ip/:id`       |
| PATCH  | `/organization-restrictions/ip/:id`       |
| GET    | `/organization-restrictions/platform`     |
| POST   | `/organization-restrictions/platform`     |
| GET    | `/organization-restrictions/platform/:id` |
| PUT    | `/organization-restrictions/platform/:id` |
| PATCH  | `/organization-restrictions/platform/:id` |

### Billing

Access: `Blocked role 4`

| Method | Endpoint                      |
| ------ | ----------------------------- |
| GET    | `/billing/payment-history`  |
| GET    | `/billing/plan-comparison`  |
| GET    | `/billing/address`          |
| GET    | `/billing/addresses`        |
| PUT    | `/billing/address`          |
| POST   | `/billing/quote`            |
| GET    | `/billing/payment-gateways` |
| POST   | `/billing/checkout-session` |
| POST   | `/billing/checkout/confirm` |

### Geo

Access: `Blocked role 4`

| Method | Endpoint                        |
| ------ | ------------------------------- |
| GET    | `/geo/countries`              |
| GET    | `/geo/states`                 |
| GET    | `/geo/currencies`             |
| GET    | `/geo/top-country-currencies` |

### Coupons

Access: `GET` = `Public`, write routes = `Owner`

| Method | Endpoint         |
| ------ | ---------------- |
| GET    | `/coupons`     |
| POST   | `/coupons`     |
| GET    | `/coupons/:id` |
| PUT    | `/coupons/:id` |
| PATCH  | `/coupons/:id` |

### Chat

Access: `JWT`

| Method | Endpoint                            | Notes |
| ------ | ----------------------------------- | ----- |
| GET    | `/chat/organizations`             | Returns all orgs the user is an active member of |
| GET    | `/chat/threads`                   | DM + group threads; supports `?org_id=` |
| GET    | `/chat/contacts`                  | Org members for starting DMs |
| GET    | `/chat/threads/:id/messages`      | Paginated messages; thread ID: `dm-{userId}` or `group-{groupId}` |
| POST   | `/chat/threads/:id/messages`      | Send message to DM or group thread (saves to DB) |
| POST   | `/chat/threads/:id/read`          | Mark all messages in thread as read |
| PATCH  | `/chat/messages/:id`              | Edit a DM message |
| DELETE | `/chat/messages/:id`              | Delete a DM message |
| GET    | `/chat/polls/:messageId`          | Get poll with options & voters |
| GET    | `/chat/polls/group/:groupId`      | List all polls in a group (paginated) |
| POST   | `/chat/polls/:messageId/vote`     | Vote / toggle vote on a poll option |
| POST   | `/chat/polls/:messageId/end`      | End a poll |
| PATCH  | `/chat/polls/:messageId`          | Edit poll question/options (creator only) |
| DELETE | `/chat/polls/:messageId`          | Soft-delete a poll (creator only) |

### Organization Profile

Access: `JWT`

| Method | Endpoint                           |
| ------ | ---------------------------------- |
| GET    | `/organization/overview`         |
| GET    | `/organization/members`          |
| GET    | `/organization/members/:userId`  |
| GET    | `/organization/departments`      |
| GET    | `/organization/designations`     |
| GET    | `/organization/locations`        |

### Payment Gateways

Access: `GET` = `JWT`, write routes = `Owner`

| Method | Endpoint                  |
| ------ | ------------------------- |
| GET    | `/payment-gateways`     |
| POST   | `/payment-gateways`     |
| GET    | `/payment-gateways/:id` |
| PUT    | `/payment-gateways/:id` |
| PATCH  | `/payment-gateways/:id` |
| DELETE | `/payment-gateways/:id` |

## Request Body Schemas

These are practical request schemas for internal TeamChatX APIs. They are example-ready shapes, not JSON Schema files.

### Auth Schemas

`POST /auth/register`

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "Secret123!"
}
```

`POST /auth/create-account`

```json
{
  "organization_name": "Acme Private Limited",
  "name": "Owner User",
  "email": "owner@example.com",
  "password": "Secret123!"
}
```

`POST /auth/login`

```json
{
  "email": "user@example.com",
  "password": "Secret123!"
}
```

`POST /auth/verify-otp`, `/auth/resend-otp`, `/auth/forgot-password`, `/auth/forgot-verify`, `/auth/reset-password`

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "NewSecret123!"
}
```

### User Schemas

`POST /users`

```json
{
  "name": "New Member",
  "email": "member@example.com",
  "mobile": "+919999999999",
  "role_id": 2,
  "department_id": 1,
  "designation_id": 1,
  "location_id": 1
}
```

`PATCH /users/bulk`

```json
{
  "updates": [
    {
      "user_id": 12,
      "role_id": 2,
      "membership_status": "active"
    }
  ]
}
```

`PUT/PATCH /users/:id`

```json
{
  "name": "Updated Member",
  "email": "member@example.com",
  "mobile": "+919999999999",
  "role_id": 2,
  "membership_status": "active"
}
```

### Global Access Schema

```json
{
  "target_user_id": 12,
  "status": "active"
}
```

### Department, Designation, Location Schemas

`POST /departments`

```json
{
  "department_name": "Engineering",
  "status": "active"
}
```

`POST /designations`

```json
{
  "designation_name": "Manager",
  "status": "active"
}
```

`POST /locations`

```json
{
  "location_name": "Mumbai",
  "status": "active"
}
```

### Master Resource Schemas

`POST /roles`

```json
{
  "role_name": "Manager",
  "role_key": "manager",
  "status": "active"
}
```

`POST /plans`

```json
{
  "plan_name": "Business",
  "plan_key": "business",
  "price": 299,
  "default_currency": "INR",
  "interval_days": 30,
  "max_users": 100,
  "max_storage_mb": 10240,
  "status": "active"
}
```

`POST /languages`

```json
{
  "language_name": "English",
  "language_code": "en",
  "status": "active"
}
```

`POST /timezones`

```json
{
  "timezone_name": "India Standard Time",
  "timezone_code": "Asia/Kolkata",
  "status": "active"
}
```

`POST /platforms`

```json
{
  "platform_name": "Windows",
  "platform_key": "windows",
  "status": "active"
}
```

`POST /message-menu-items`

```json
{
  "menu_name": "Reply",
  "menu_key": "reply",
  "status": "active"
}
```

### Group Schemas

`POST /groups`

```json
{
  "group_name": "Operations",
  "member_ids": [1, 2, 3]
}
```

`POST /group-members`

```json
{
  "group_id": 1,
  "user_id": 2
}
```

### Organization Message Menu Permission Schema

```json
{
  "menu_item_id": 1,
  "enabled": true
}
```

### Plan Feature Schema

```json
{
  "plan_id": 1,
  "feature_name": "Audit Logs",
  "feature_key": "audit_logs",
  "enabled": true
}
```

### Site Detail Schema

```json
{
  "site_name": "TeamChatX",
  "support_email": "support@example.com",
  "support_phone": "+919999999999",
  "address_line1": "Street 1",
  "city": "Mumbai",
  "country": "India"
}
```

### Product Feature Schemas

`POST /product-features/categories`

```json
{
  "category_name": "Security",
  "category_key": "security",
  "status": "active"
}
```

`POST /product-features`

```json
{
  "category_id": 1,
  "title": "SSO",
  "description": "Single sign-on support",
  "status": "active"
}
```

### Contact Us Schema

```json
{
  "name": "Lead User",
  "email": "lead@example.com",
  "mobile": "+919999999999",
  "message": "Need a demo"
}
```

### Organization Restriction Schemas

`POST /organization-restrictions/ip`

```json
{
  "ip_address": "10.0.0.1",
  "status": "active"
}
```

`POST /organization-restrictions/platform`

```json
{
  "platform_id": 1,
  "status": "active"
}
```

### Billing Schemas

`PUT /billing/address`

```json
{
  "full_name": "Billing User",
  "company": "Acme Private Limited",
  "address_line1": "Street 1",
  "address_line2": "Suite 101",
  "city": "Mumbai",
  "state": "MH",
  "postal_code": "400001",
  "country": "India",
  "country_id": 101,
  "state_id": 22,
  "email": "billing@example.com",
  "mobile": "+919999999999"
}
```

`POST /billing/quote`

```json
{
  "plan_id": 1,
  "user_count": 10,
  "cycle": "month",
  "country": "India",
  "currency": "INR",
  "coupon_code": "SAVE10"
}
```

`POST /billing/checkout-session`

```json
{
  "gateway": "stripe",
  "plan_id": 1,
  "user_count": 10,
  "cycle": "month",
  "currency": "INR",
  "country": "India",
  "billing_type": "renewal",
  "billing_email": "billing@example.com",
  "coupon_code": "SAVE10",
  "address": {
    "full_name": "Billing User",
    "company": "Acme Private Limited",
    "address_line1": "Street 1",
    "address_line2": "Suite 101",
    "city": "Mumbai",
    "state": "MH",
    "postal_code": "400001",
    "country": "India",
    "country_id": 101,
    "state_id": 22,
    "email": "billing@example.com",
    "mobile": "+919999999999"
  }
}
```

`POST /billing/checkout/confirm`

```json
{
  "session_id": "cs_test_123",
  "gateway": "stripe"
}
```

### Coupon Schema

```json
{
  "coupon_code": "SAVE10",
  "coupon_name": "Save 10",
  "description": "Ten percent discount",
  "discount_type": "percent",
  "discount_value": 10,
  "currency_code": "INR",
  "min_order_amount": 100,
  "max_discount_amount": 1000,
  "status": "active"
}
```

## Response Examples

### Health Response

```json
{
  "status": "ok",
  "timestamp": "2026-03-10T10:30:00.000Z"
}
```

### Auth Response

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "user_id": 1,
      "name": "Owner User",
      "email": "owner@example.com"
    },
    "access_token": "jwt-token"
  }
}
```

### List Response

```json
{
  "status": "success",
  "message": "Records fetched successfully",
  "data": {
    "rows": [
      {
        "id": 1,
        "name": "Example"
      }
    ],
    "total": 1
  }
}
```

### Detail Response

```json
{
  "status": "success",
  "message": "Record fetched successfully",
  "data": {
    "id": 1,
    "name": "Example"
  }
}
```

### Billing Quote Response

```json
{
  "status": "success",
  "message": "Billing quote calculated",
  "data": {
    "plan_id": 1,
    "plan_name": "Business",
    "user_count": 10,
    "cycle": "month",
    "currency": "INR",
    "period_months": 1,
    "per_user_monthly": 299,
    "per_user_cycle": 299,
    "subtotal": 2990,
    "discount_amount": 0,
    "total_before_discount": 2990,
    "total": 2990
  }
}
```

### Billing Checkout Session Response

```json
{
  "status": "success",
  "message": "Stripe checkout session created",
  "data": {
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_xxx",
    "session_id": "cs_test_xxx",
    "amount_total": 2990,
    "currency": "INR"
  }
}
```

### Payment History Response

```json
{
  "status": "success",
  "message": "Payment history retrieved",
  "data": {
    "rows": [
      {
        "payment_history_id": 1,
        "invoice_number": "INV-123456",
        "payment_status": "success",
        "currency_code": "INR",
        "amount": 2990
      }
    ],
    "total": 1
  }
}
```

### Validation Error Response

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    "email is required"
  ]
}
```

## Postman Collection

- Collection file: [teamchatx-api.postman_collection.json](c:/Users/DELL/OneDrive/Desktop/TeamChat/backend/docs/teamchatx-api.postman_collection.json)
- Environment values to set in Postman:
  - `baseUrl`
  - `token`
  - `csrfToken`

## Group-wise cURL Requests

### Health

```bash
curl "$BASE_URL/health"
```

### Auth

```bash
curl -X GET "$BASE_URL/auth/csrf"

curl -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"name":"User","email":"user@example.com","password":"Secret123!"}'
curl -X POST "$BASE_URL/auth/create-account" -H "Content-Type: application/json" -d '{"organization_name":"Acme","name":"Owner","email":"owner@example.com","password":"Secret123!"}'
curl -X POST "$BASE_URL/auth/resend-otp" -H "Content-Type: application/json" -d '{"email":"user@example.com"}'
curl -X POST "$BASE_URL/auth/verify-otp" -H "Content-Type: application/json" -d '{"email":"user@example.com","otp":"123456"}'
curl -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"Secret123!"}'
curl -X POST "$BASE_URL/auth/refresh" -H "Content-Type: application/json" -d '{}'
curl -X POST "$BASE_URL/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"user@example.com"}'
curl -X POST "$BASE_URL/auth/forgot-verify" -H "Content-Type: application/json" -d '{"email":"user@example.com","otp":"123456"}'
curl -X POST "$BASE_URL/auth/reset-password" -H "Content-Type: application/json" -d '{"email":"user@example.com","otp":"123456","password":"NewSecret123!"}'

curl "$BASE_URL/auth/me" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/auth/trusted-devices" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/auth/trusted-devices/device-id/revoke" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X POST "$BASE_URL/auth/change-password" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"current_password":"Old123!","new_password":"New123!"}'
curl -X POST "$BASE_URL/auth/logout" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X POST "$BASE_URL/auth/logout-all" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl "$BASE_URL/auth/user-details" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/auth/user-details" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"user_id":1}'
curl "$BASE_URL/auth/organization-details" -H "Authorization: Bearer $TOKEN"
```

### Users

```bash
curl -X POST "$BASE_URL/users/forgot-password" -H "Content-Type: application/json" -d '{"email":"user@example.com"}'
curl -X POST "$BASE_URL/users/forgot-verify" -H "Content-Type: application/json" -d '{"email":"user@example.com","otp":"123456"}'

curl "$BASE_URL/users" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/users" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"name":"New User","email":"new@example.com","role_id":2}'
curl -X PATCH "$BASE_URL/users/bulk" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"updates":[{"user_id":1,"role_id":2}]}'
curl -X POST "$BASE_URL/users/reset-password" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"email":"new@example.com"}'
curl "$BASE_URL/users/1" -H "Authorization: Bearer $TOKEN"
curl -X PUT "$BASE_URL/users/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"name":"Updated User"}'
curl -X PATCH "$BASE_URL/users/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"membership_status":"active"}'
curl -X DELETE "$BASE_URL/users/1" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X PATCH "$BASE_URL/users/1/deactivate" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X PATCH "$BASE_URL/users/1/activate" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X POST "$BASE_URL/users/1/resend-invite" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
```

### Global Access

```bash
curl "$BASE_URL/global-access" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/global-access/allowed-users" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/global-access/1" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/global-access" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"target_user_id":2}'
curl -X PUT "$BASE_URL/global-access/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"target_user_id":2}'
curl -X PATCH "$BASE_URL/global-access/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"status":"active"}'
curl -X DELETE "$BASE_URL/global-access/1" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
```

### Organization Structure

```bash
curl "$BASE_URL/departments" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/departments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"department_name":"Engineering"}'
curl "$BASE_URL/designations" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/designations" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"designation_name":"Manager"}'
curl "$BASE_URL/locations" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/locations" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"location_name":"Mumbai"}'
```

### Master Resources

```bash
curl "$BASE_URL/roles" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/roles" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"role_name":"Manager","role_key":"manager"}'

curl "$BASE_URL/plans"
curl -X POST "$BASE_URL/plans" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"plan_name":"Business","plan_key":"business","price":299}'

curl "$BASE_URL/languages" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/timezones" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/platforms" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/message-menu-items" -H "Authorization: Bearer $TOKEN"
```

### Activity, Groups, Timeline

```bash
curl "$BASE_URL/activity-logs" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/groups" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/groups" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"group_name":"Ops","member_ids":[1,2]}'
curl "$BASE_URL/group-members" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/group-members/by-group-name?group_name=Ops" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/group-members" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"group_id":1,"user_id":2}'
curl "$BASE_URL/group-timeline" -H "Authorization: Bearer $TOKEN"
```

### Organization Message Menu Permissions

```bash
curl "$BASE_URL/organization-message-menu-permissions" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/organization-message-menu-permissions" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"menu_item_id":1,"enabled":true}'
curl "$BASE_URL/organization-message-menu-permissions/1" -H "Authorization: Bearer $TOKEN"
curl -X PUT "$BASE_URL/organization-message-menu-permissions/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"enabled":true}'
curl -X PATCH "$BASE_URL/organization-message-menu-permissions/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"enabled":false}'
```

### Plan Features, Site Details, Product Features

```bash
curl "$BASE_URL/plan-features/plan/1/summary" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/plan-features" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/plan-features" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"plan_id":1,"feature_name":"Audit Logs","enabled":true}'

curl "$BASE_URL/site-details"
curl -X POST "$BASE_URL/site-details" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"site_name":"TeamChatX"}'

curl "$BASE_URL/product-features/catalog"
curl "$BASE_URL/product-features/categories"
curl -X POST "$BASE_URL/product-features/categories" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"category_name":"Security","category_key":"security"}'
curl "$BASE_URL/product-features"
curl -X POST "$BASE_URL/product-features" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"category_id":1,"title":"SSO","status":"active"}'
```

### Contact Us

```bash
curl -X POST "$BASE_URL/contact-us" -H "Content-Type: application/json" -d '{"name":"Lead User","country_code":"+91","mobile_number":"9999999999","email_address":"lead@example.com","company_name":"Example Inc","total_users":25,"requirement_details":"Need a demo"}'
curl "$BASE_URL/contact-us" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/contact-us/1" -H "Authorization: Bearer $TOKEN"
```

### Organization Restrictions

```bash
curl "$BASE_URL/organization-restrictions/ip" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/organization-restrictions/ip" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"ip_address":"10.0.0.1","status":"active"}'
curl "$BASE_URL/organization-restrictions/platform" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/organization-restrictions/platform" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"platform_id":1,"status":"active"}'
```

### Billing

```bash
curl "$BASE_URL/billing/payment-history" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/billing/plan-comparison" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/billing/address" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/billing/addresses?limit=2" -H "Authorization: Bearer $TOKEN"
curl -X PUT "$BASE_URL/billing/address" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"full_name":"Billing User","company":"Acme","address_line1":"Street 1","city":"Mumbai","state":"MH","postal_code":"400001","country":"India","email":"billing@example.com","mobile":"+919999999999"}'
curl -X POST "$BASE_URL/billing/quote" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"plan_id":1,"user_count":10,"cycle":"month","country":"India","currency":"INR"}'
curl -X POST "$BASE_URL/billing/checkout-session" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"plan_id":1,"user_count":10,"cycle":"month","currency":"INR","country":"India","billing_type":"renewal","billing_email":"billing@example.com","address":{"full_name":"Billing User","company":"Acme","address_line1":"Street 1","city":"Mumbai","state":"MH","postal_code":"400001","country":"India","email":"billing@example.com","mobile":"+919999999999"}}'
curl -X POST "$BASE_URL/billing/checkout/confirm" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"session_id":"cs_test_123"}'
```

### Geo

```bash
curl "$BASE_URL/geo/countries?status=active&limit=100&offset=0" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/geo/states?country_id=1&limit=100&offset=0" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/geo/currencies?status=active&limit=500&offset=0" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/geo/top-country-currencies?limit=50&offset=0" -H "Authorization: Bearer $TOKEN"
```

### Coupons

```bash
curl "$BASE_URL/coupons"
curl "$BASE_URL/coupons/1"
curl -X POST "$BASE_URL/coupons" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"coupon_code":"SAVE10","coupon_name":"Save 10","discount_type":"percent","discount_value":10,"status":"active"}'
curl -X PUT "$BASE_URL/coupons/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"coupon_name":"Updated Coupon"}'
curl -X PATCH "$BASE_URL/coupons/1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"status":"inactive"}'
```

### Chat

```bash
curl "$BASE_URL/chat/organizations" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/chat/threads" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/chat/threads?org_id=2" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/chat/contacts" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/chat/threads/dm-5/messages?limit=30&offset=0" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE_URL/chat/threads/dm-5/messages" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"body":"Hello!"}'
curl -X POST "$BASE_URL/chat/threads/group-12/messages" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"body":"Hello group!"}'
curl -X POST "$BASE_URL/chat/threads/dm-5/read" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
curl -X PATCH "$BASE_URL/chat/messages/101" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"body":"Edited message"}'
curl -X DELETE "$BASE_URL/chat/messages/101" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
```

### Organization Profile

```bash
curl "$BASE_URL/organization/overview" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/organization/members" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/organization/members/9" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/organization/departments" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/organization/designations" -H "Authorization: Bearer $TOKEN"
curl "$BASE_URL/organization/locations" -H "Authorization: Bearer $TOKEN"
```

# Docs Sync (2026-03-10)

- Billing endpoints now reflect exact payment failure capture, activity-log side effects, and invoice numbers generated from `payment_history.payment_id`.
- Access notes, request schemas, response examples, and cURL references were expanded and kept limited to internal TeamChatX APIs.
- External Stripe REST endpoints remain intentionally excluded from this document.

## Update Log (2026-03-13)

- Chat module endpoints added to Endpoint Inventory (`/chat`):
  - `GET /chat/organizations` — multi-org membership list (JWT)
  - `GET /chat/threads?org_id=` — DM + group thread list per org (JWT)
  - `GET /chat/contacts` — org contacts for starting DMs (JWT)
  - `GET /chat/threads/:id/messages` — paginated messages for DM or group thread (JWT)
  - `POST /chat/threads/:id/messages` — send message; persists to DB (JWT)
  - `POST /chat/threads/:id/read` — mark thread as read (JWT)
  - `PATCH /chat/messages/:id` — edit DM message (JWT)
  - `DELETE /chat/messages/:id` — delete DM message (JWT)
  - Thread ID format: `dm-{userId}` for DMs, `group-{groupId}` for groups
- Organization profile module endpoints added (`/organization`):
  - `GET /organization/overview` (JWT)
  - `GET /organization/members` (JWT)
  - `GET /organization/members/:userId` (JWT)
  - `GET /organization/departments` (JWT)
  - `GET /organization/designations` (JWT)
  - `GET /organization/locations` (JWT)
- cURL examples added for all new `/chat` and `/organization` routes.

### Group Creation API (New)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/groups/create` | JWT | Create group + add all members in one transaction |

**Request:**
```json
{
  "name": "Development Team",
  "description": "Frontend + Backend devs",
  "members": [2, 3, 5, 8]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "group": { "group_id": 15, "group_name": "Development Team", ... },
    "groupId": 15,
    "threadId": "group-15",
    "memberCount": 5
  }
}
```

**What it does:**
1. Creates `groups` table record
2. Adds creator as admin member + all selected members to `group_members`
3. Creates `group_timeline` event: "group_created"
4. Invalidates socket group members cache
5. Returns real `group_id` and `threadId` for frontend to use

---

## Group Polls (`/chat/polls`)

All endpoints require JWT authentication via `Authorization: Bearer <token>`.

### Get Poll by Message ID

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/polls/:messageId` | JWT | Get full poll details including options & voters |

**Response:**
```json
{
  "status": "success",
  "data": {
    "poll_id": 1,
    "group_message_id": 450,
    "group_id": 3,
    "question": "What day works best for standup?",
    "poll_type": "single",
    "show_results_before_vote": false,
    "ends_at": "2026-03-25T18:00:00.000Z",
    "end_permission": "creator_admin",
    "status": "active",
    "created_by": 2,
    "created_at": "2026-03-24T10:00:00.000Z",
    "options": [
      {
        "option_id": 1,
        "option_text": "Monday",
        "vote_count": 3,
        "order_no": 1,
        "voters": [
          { "userId": 2, "votedAt": "2026-03-24T10:05:00.000Z" },
          { "userId": 3, "votedAt": "2026-03-24T10:06:00.000Z" },
          { "userId": 5, "votedAt": "2026-03-24T10:07:00.000Z" }
        ]
      },
      {
        "option_id": 2,
        "option_text": "Wednesday",
        "vote_count": 1,
        "order_no": 2,
        "voters": [
          { "userId": 4, "votedAt": "2026-03-24T10:08:00.000Z" }
        ]
      }
    ]
  }
}
```

### List Group Polls

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/polls/group/:groupId` | JWT | List all polls in a group (paginated) |

**Query params:** `limit` (default 20, max 100), `offset` (default 0)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "poll_id": 1,
      "group_message_id": 450,
      "group_id": 3,
      "question": "What day works best?",
      "poll_type": "single",
      "status": "active",
      "created_by": 2,
      "creator_name": "Bhavesh Singh",
      "total_votes": 4,
      "created_at": "2026-03-24T10:00:00.000Z"
    }
  ]
}
```

### Vote on a Poll

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/polls/:messageId/vote` | JWT | Vote or toggle vote on a poll option |

**Request:**
```json
{
  "optionId": 1
}
```

**Response (vote added):**
```json
{
  "status": "success",
  "data": {
    "action": "added",
    "poll": { "...full poll object with updated counts..." }
  }
}
```

**Response (vote removed — toggle off):**
```json
{
  "status": "success",
  "data": {
    "action": "removed",
    "poll": { "...full poll object with updated counts..." }
  }
}
```

**Behaviour:**
- Single-choice polls: existing votes are removed before adding the new vote
- Multi-choice polls: voting the same option again toggles it off
- Returns `400` if poll has ended or expired

### End a Poll

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/polls/:messageId/end` | JWT | End an active poll (stops accepting votes) |

**Response:**
```json
{
  "status": "success",
  "data": {
    "poll_id": 1,
    "status": "ended",
    "ended_at": "2026-03-24T12:00:00.000Z",
    "ended_by": 2
  }
}
```

### Edit a Poll

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/chat/polls/:messageId` | JWT | Edit poll question and/or options (creator only) |

**Request:**
```json
{
  "question": "Updated question text?",
  "options": [
    { "option_id": 1, "text": "Updated option A" },
    { "option_id": 2, "text": "Updated option B" },
    { "text": "New option C" }
  ]
}
```

**Notes:**
- Only the poll creator can edit
- Cannot edit an ended poll
- Options with `option_id` update existing options; options without `option_id` are added as new

**Response:**
```json
{
  "status": "success",
  "data": { "...updated poll object..." }
}
```

### Delete a Poll

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| DELETE | `/chat/polls/:messageId` | JWT | Soft-delete a poll (creator only) |

**Response:**
```json
{
  "status": "success",
  "data": { "deleted": true }
}
```

### cURL Examples

```bash
# Get poll by message ID
curl "$BASE_URL/chat/polls/450" -H "Authorization: Bearer $TOKEN"

# List group polls (paginated)
curl "$BASE_URL/chat/polls/group/3?limit=20&offset=0" -H "Authorization: Bearer $TOKEN"

# Vote on a poll
curl -X POST "$BASE_URL/chat/polls/450/vote" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"optionId":1}'

# End a poll
curl -X POST "$BASE_URL/chat/polls/450/end" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"

# Edit a poll
curl -X PATCH "$BASE_URL/chat/polls/450" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF_TOKEN" -d '{"question":"New question?","options":[{"option_id":1,"text":"A"},{"option_id":2,"text":"B"}]}'

# Delete a poll
curl -X DELETE "$BASE_URL/chat/polls/450" -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF_TOKEN"
```

### Socket.IO Events (Real-time)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `poll:vote` | Client → Server | `{ messageId, threadId, optionId, pollType }` | Cast or toggle a vote |
| `poll:end` | Client → Server | `{ messageId, threadId, endedAt }` | End a poll |
| `poll:edit` | Client → Server | `{ messageId, threadId, poll }` | Edit poll question/options |
| `poll:voted` | Server → Client | `{ messageId, threadId, poll }` | Broadcast updated poll after vote |
| `poll:ended` | Server → Client | `{ messageId, threadId, poll }` | Broadcast poll ended |
| `poll:edited` | Server → Client | `{ messageId, threadId, poll }` | Broadcast poll edited |

### Database Tables

| Table | Key Columns |
|-------|-------------|
| `group_polls` | poll_id, group_message_id, group_id, question, poll_type (`single`/`multiple`), show_results_before_vote, ends_at, end_permission (`creator_only`/`creator_admin`/`admin`), status (`active`/`ended`/`deleted`), created_by, ended_by |
| `group_poll_options` | option_id, poll_id, option_text, vote_count, order_no |
| `group_poll_votes` | vote_id, poll_id, option_id, user_id, voted_at (unique: poll_id + user_id + option_id) |

---

## AI Assistant Module (`/live-assistant`)

All endpoints require JWT authentication via `Authorization: Bearer <token>`.

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/live-assistant/chat` | JWT | Send message to AI assistant |

**Request:**
```json
{
  "messages": [{ "role": "user", "content": "How to edit a message?" }],
  "systemPrompt": "optional custom prompt",
  "workspaceContext": "optional workspace info string"
}
```

**Response:**
```json
{
  "status": "success",
  "data": { "reply": "AI response text...", "responseMs": 1234 }
}
```

**Rate limiting:** 50 requests/hour per user. Returns `429` when exceeded.
Response headers: `x-ratelimit-remaining`, `x-ratelimit-limit`.

**Features:**
- Auto-injects organization knowledge base into AI context
- Auto-injects active broadcasts into AI context
- Supports Gemini, OpenAI, Claude (switchable from `ai_providers` table)
- Tracks usage per user per day in `assistant_usage` table

### Feedback

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/live-assistant/feedback` | JWT | Submit thumbs up/down feedback |

**Request:**
```json
{
  "messageText": "user question",
  "responseText": "AI response",
  "rating": "up"
}
```

### Conversations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/live-assistant/conversations` | JWT | List user's past conversations |
| POST | `/live-assistant/conversations` | JWT | Save new conversation |
| GET | `/live-assistant/conversations/search?q=keyword` | JWT | Search conversations by keyword |
| GET | `/live-assistant/conversations/:id` | JWT | Load specific conversation |
| PATCH | `/live-assistant/conversations/:id` | JWT | Update conversation title/messages |
| DELETE | `/live-assistant/conversations/:id` | JWT | Delete conversation |
| GET | `/live-assistant/conversations/:id/export` | JWT | Download conversation as .txt file |

**Save Request:**
```json
{
  "title": "How to edit messages",
  "messages": [
    { "role": "user", "content": "How to edit?" },
    { "role": "assistant", "content": "Click the edit icon..." }
  ]
}
```

**Search:** `GET /live-assistant/conversations/search?q=edit&limit=20&offset=0`

**Export:** Returns `Content-Type: text/plain` file download.

### Broadcasts (Owner Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/live-assistant/broadcasts` | JWT + Owner | List active broadcasts |
| POST | `/live-assistant/broadcasts` | JWT + Owner | Create broadcast |
| PATCH | `/live-assistant/broadcasts/:id` | JWT + Owner | Update broadcast |
| DELETE | `/live-assistant/broadcasts/:id` | JWT + Owner | Delete broadcast |

**Create Request:**
```json
{
  "message": "System maintenance scheduled at 10 PM tonight",
  "priority": "high",
  "expires_at": "2026-03-20T22:00:00Z"
}
```

Priority values: `normal`, `high`, `urgent`.
Active broadcasts are automatically injected into AI assistant context for all users in the organization.

### Knowledge Base (Owner Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/live-assistant/knowledge` | JWT + Owner | List all knowledge entries |
| POST | `/live-assistant/knowledge` | JWT + Owner | Create knowledge entry |
| PATCH | `/live-assistant/knowledge/:id` | JWT + Owner | Update knowledge entry |
| DELETE | `/live-assistant/knowledge/:id` | JWT + Owner | Delete knowledge entry |

**Create Request:**
```json
{
  "title": "Office VPN Setup",
  "content": "Connect to vpn.company.com using credentials from IT. Download the client from...",
  "category": "IT"
}
```

Active knowledge entries are automatically injected into AI assistant context. The AI uses this information to answer organization-specific questions.

### Usage Analytics (Owner Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/live-assistant/usage?org_id=1&days=30` | JWT + Owner | Daily usage stats |

**Response:**
```json
{
  "data": {
    "stats": [
      { "date": "2026-03-19", "total_questions": 45, "unique_users": 8, "avg_response_ms": 1200 }
    ]
  }
}
```

## Update Log (2026-03-24)

- Group Polls REST API added (`/chat/polls`):
  - `GET /chat/polls/:messageId` — full poll with options & voters (JWT)
  - `GET /chat/polls/group/:groupId` — paginated poll list per group (JWT)
  - `POST /chat/polls/:messageId/vote` — vote/toggle on a poll option (JWT)
  - `POST /chat/polls/:messageId/end` — end a poll (JWT)
  - `PATCH /chat/polls/:messageId` — edit poll question/options, creator only (JWT)
  - `DELETE /chat/polls/:messageId` — soft-delete poll, creator only (JWT)
- Socket.IO poll events documented: `poll:vote`, `poll:end`, `poll:edit`, `poll:voted`, `poll:ended`, `poll:edited`
- Database tables documented: `group_polls`, `group_poll_options`, `group_poll_votes`
