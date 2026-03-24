# TeamChatX Complete API Documentation

Last updated: 2026-03-10

This document is the source of truth for:

- all API routes
- role-wise access control
- request/response examples
- organization scoping behavior

## 1. Base Information

- Base URL (local): `http://localhost:5000`
- Health check: `GET /health`
- Content type: `application/json`
- Auth header:

```text
Authorization: Bearer <access_token>
```

Standard success response:

```json
{
  "status": "success",
  "message": "Human readable message",
  "data": {}
}
```

Standard error response:

```json
{
  "status": "error",
  "message": "Human readable message",
  "errors": null
}
```

## 2. Role & Access Matrix

Roles from token (`req.user.role_id`):

- `1` = Owner (full access including master data writes)
- `4` = Restricted role (blocked from many management/write routes)
- Other roles = JWT-protected access based on route middleware

### 2.1 Public APIs (No JWT)

- `GET /health`
- `POST /auth/register`
- `POST /auth/create-account`
- `POST /auth/resend-otp`
- `POST /auth/verify-otp`
- `POST /auth/login`
- `GET /auth/csrf`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/forgot-verify`
- `POST /users/forgot-password`
- `POST /users/forgot-verify`
- `GET /plans`
- `GET /plans/:id`
- `GET /site-details`
- `GET /site-details/:id`
- `GET /product-features`
- `GET /product-features/:id`
- `GET /product-features/categories`
- `GET /product-features/categories/:categoryId`
- `GET /product-features/catalog`

### 2.2 JWT Required (Any role)

- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/trusted-devices`
- `POST /auth/trusted-devices/:deviceId/revoke`
- `GET /groups`
- `GET /groups/:id`
- `GET /group-members`
- `GET /group-members/by-group-name`
- `GET /group-members/:id`
- `GET /group-timeline`
- `GET /global-access`
- `GET /global-access/:id`
- `GET /global-access/allowed-users`
- `GET /organization-message-menu-permissions` (`role_id=4` blocked)
- `GET /organization-message-menu-permissions/:id` (`role_id=4` blocked)
- `GET /plan-features`
- `GET /plan-features/:id`
- `GET /plan-features/plan/:planId/summary`
- `GET /contact-us` (`role_id=4` blocked)
- `GET /contact-us/:id` (`role_id=4` blocked)
- Read-only for master data:
  - `GET /roles`, `GET /roles/:id`
  - `GET /languages`, `GET /languages/:id`
  - `GET /timezones`, `GET /timezones/:id`
  - `GET /platforms`, `GET /platforms/:id`
  - `GET /message-menu-items`, `GET /message-menu-items/:id`

### 2.3 `role_id = 1` Only (Owner)

Write methods for master data:

- `POST /roles`, `PUT/PATCH/DELETE /roles/:id`
- `POST /plans`, `PUT/PATCH/DELETE /plans/:id`
- `POST /languages`, `PUT/PATCH/DELETE /languages/:id`
- `POST /timezones`, `PUT/PATCH/DELETE /timezones/:id`
- `POST /platforms`, `PUT/PATCH/DELETE /platforms/:id`
- `POST /message-menu-items`, `PUT/PATCH/DELETE /message-menu-items/:id`
- `POST /plan-features`, `PUT/PATCH /plan-features/:id`
- `POST /product-features`, `PUT/PATCH /product-features/:id`
- `POST /product-features/categories`, `PUT/PATCH /product-features/categories/:categoryId`
- `POST /site-details`, `PUT/PATCH /site-details/:id`
- `POST /contact-us` (public)

### 2.4 `role_id = 4` Blocked

Blocked (`403 Access denied`) for all methods:

- `/departments`
- `/designations`
- `/locations`
- `/users` protected routes
- `/activity-logs`
- `GET /auth/user-details`
- `POST /auth/user-details`
- `GET /auth/organization-details`

Blocked only for write methods on global access:

- `POST /global-access`
- `PUT /global-access/:id`
- `PATCH /global-access/:id`
- `DELETE /global-access/:id`

Blocked only for write methods on groups:

- `POST /groups`
- `PUT /groups/:id`
- `PATCH /groups/:id`

Blocked only for write methods on group members:

- `POST /group-members`
- `PUT /group-members/:id`
- `PATCH /group-members/:id`

Blocked for all methods on organization message menu permissions:

- `GET /organization-message-menu-permissions`
- `GET /organization-message-menu-permissions/:id`
- `POST /organization-message-menu-permissions`
- `PUT /organization-message-menu-permissions/:id`
- `PATCH /organization-message-menu-permissions/:id`

### 2.5 Roles Table Snapshot

Reference snapshot of current `roles` master data:

![Roles Table Snapshot](image/database/1771936687102.png)

## 3. Organization Scope Rules

Several APIs enforce org context via token and membership:

- If `org_id`/`organization_id` is provided, requester must be active member in that org.
- If not provided, token org (`req.user.org`) is used.
- If requester is not active member in requested org -> `403 Access denied for requested organization`.

## 4. Auth APIs (`/auth`)

### 4.1 `POST /auth/create-account`

Creates user + organization + membership + subscription + OTP.
Rules:

- `email` must be business email (free email domains blocked).
- `phone` must be valid international format (8-15 digits, optional `+`).

Example body:

```json
{
  "company_name": "Acme Pvt Ltd",
  "owner_name": "Rohit Sharma",
  "email": "rohit@acme.com",
  "phone": "+919876543210",
  "password": "StrongPass123"
}
```

### 4.2 `POST /auth/verify-otp`

```json
{
  "email": "rohit@acme.com",
  "otp_code": "123456"
}
```

### 4.3 `POST /auth/resend-otp`

```json
{
  "email": "rohit@acme.com"
}
```

### 4.4 `POST /auth/login`

```json
{
  "email": "rohit@acme.com",
  "password": "StrongPass123",
  "client_device_id": "web-chrome-01",
  "device_name": "Rohit Laptop",
  "device_type": "desktop"
}
```

Behavior:

- If `client_device_id` is missing/untrusted and `otp_code` is not sent, login OTP is issued.
- Verify by sending `otp_code` in login request.
- Trusted `client_device_id` can skip OTP.
- Same `client_device_id` device can remain OTP-free after logout (session revoked, trust retained).
- OTP should trigger only for new/unrecognized devices.

### 4.5 `POST /auth/refresh`

```json
{
  "refresh_token": "<refresh_token>",
  "client_device_id": "web-chrome-01"
}
```

Security behavior:

- revoked refresh token reuse detect hone par API `401` return karti hai.
- response error me `force_logout_all=true` aata hai.
- backend user ke sab active sessions revoke karta hai.

### 4.6 `GET /auth/csrf`

Purpose:

- auth cookie based unsafe requests ke liye fresh CSRF token issue karna.

Response:

```json
{
  "status": "success",
  "message": "CSRF token ready",
  "data": {
    "csrf_token": "<csrf_token>"
  }
}
```

### 4.7 `POST /auth/logout`

JWT required.

Request can include one of `refresh_token`, `device_id`, `client_device_id`.

```json
{
  "refresh_token": "<refresh_token>",
  "client_device_id": "web-chrome-01"
}
```

### 4.8 `POST /auth/logout-all`

JWT required. Revokes all active sessions and marks all devices logged out for current user.

### 4.9 `GET /auth/trusted-devices`

JWT required. Returns trusted devices list for current user.

### 4.10 `POST /auth/trusted-devices/:deviceId/revoke`

JWT required. Revokes trust for given device and revokes its active sessions.

### 4.11 `POST /auth/change-password`

JWT required.

```json
{
  "old_password": "OldStrongPass123",
  "new_password": "NewStrongPass123",
  "confirm_password": "NewStrongPass123"
}
```

### 4.12 `GET /auth/me`

Returns full current user context (expanded response).

Now includes:

- user profile fields
- organization details
- owner details
- organization membership + role
- current plan
- storage usage
- counts (members/devices/sessions/otp/global-access)
- lists: `organization_members`, `user_devices`, `user_sessions`, `otp_verifications`, `global_access_allowed_users`

Optional query:

- `limit` (default `25`, max `100`) controls list sizes.

### 4.13 `GET|POST /auth/user-details` (`role_id=4` blocked)

Input supports `email`, `full`, `limit`.

### 4.14 `GET /auth/organization-details` (`role_id=4` blocked)

Purpose:

- get organization summary by `organization_id`
- includes members count, storage usage, current plan, role distribution, structure counts

Query params:

- `organization_id` (optional, default token org)

Example:

```text
/auth/organization-details?organization_id=2
```

JSON response example:

```json
{
  "status": "success",
  "message": "Organization details retrieved",
  "data": {
    "organization": {
      "organization_id": 2,
      "org_key": "demo_x1y2z3",
      "name": "Demo Org",
      "subdomain": "demo-org",
      "custom_domain": "vedsu.com",
      "status": "active",
      "created_at": "2026-02-19T10:10:10.000Z",
      "updated_at": "2026-02-19T10:10:10.000Z"
    },
    "owner": {
      "owner_id": 1,
      "owner_name": "Owner User",
      "owner_email": "owner@vedsu.com"
    },
    "current_plan": {
      "subscription_id": 10,
      "plan_id": 1,
      "plan_key": "basic",
      "plan_name": "Basic",
      "subscription_status": "active",
      "start_date": "2026-02-01",
      "end_date": "2026-03-02",
      "interval_days": 30,
      "price": "999.00",
      "max_users": 50,
      "max_storage_mb": 2048
    },
    "usage": {
      "storage_used_mb": 256,
      "storage_limit_mb": 2048,
      "storage_usage_percent": 12.5
    },
    "counts": {
      "total_members": 12,
      "active_members": 10,
      "invited_members": 1,
      "suspended_members": 1,
      "left_members": 0,
      "global_members": 2,
      "platform_admin_members": 1,
      "departments": 3,
      "designations": 7,
      "locations": 2,
      "total_activity_logs": 120
    },
    "role_distribution": [
      {
        "role_id": 3,
        "role_key": "admin",
        "role_name": "Admin",
        "total": 2
      },
      {
        "role_id": 4,
        "role_key": "users",
        "role_name": "Users",
        "total": 8
      }
    ]
  }
}
```

Activity log:

- action: `organization.details.view`

### 4.15 Forgot Password

- `POST /auth/forgot-password`
- `POST /auth/forgot-verify`
- `POST /auth/reset-password`

Step 1 (request OTP):

```json
{
  "email": "rohit@acme.com"
}
```

Step 2 (verify OTP and get `reset_token` + `reset_link`):

```json
{
  "email": "rohit@acme.com",
  "otp_code": "123456"
}
```

If OTP is invalid, API returns HTTP `200` with business error and live attempt counters:

```json
{
  "status": "error",
  "message": "Invalid OTP. Attempt 1/5. 4 attempts left",
  "errors": {
    "attempt_number": 1,
    "max_attempts": 5,
    "attempts_left": 4
  }
}
```

Step 3 (set new password with `reset_token`):

```json
{
  "reset_token": "<reset_token>",
  "new_password": "NewStrongPass123"
}
```

## 4.16 JWT Expiry Model (Secure Session)

Environment:

- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=90d`

Behavior:

- access token short TTL rakha gaya hai to reduce bearer-token risk.
- refresh token long TTL ke saath server-side `user_sessions` table me tracked hai.
- `/auth/refresh` session validate karke token pair rotate karta hai.
- refresh reuse detection par `force_logout_all` security response return hota hai.
- device-aware logout (`refresh_token`, `device_id`, `client_device_id`) supported hai.
- `/auth/logout-all` user ki sab active sessions revoke karta hai.

Result:

- user ko frequent login nahi karna padta.
- compromise blast radius short access token ke kaaran limited rehta hai.

## 5. Organization User APIs (`/users`)

Protected `/users` routes: JWT required, `role_id=4` blocked.

Public helpers:

- `POST /users/forgot-password`
- `POST /users/forgot-verify`

Protected routes:

- `GET /users`
- `POST /users`
- `PATCH /users/bulk`
- `POST /users/reset-password`
- `GET /users/:id`
- `PUT /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id` (soft delete membership status)
- `PATCH /users/:id/deactivate`
- `PATCH /users/:id/activate`

### 5.1 `POST /users` example

```json
{
  "organization_id": 2,
  "name": "Amit",
  "email": "amit@acme.com",
  "mobile": "9999999999",
  "role_id": 4,
  "department_id": 1,
  "designation_id": 2,
  "location_id": 1,
  "is_platform_admin": false,
  "is_global_member": true
}
```

## 6. Organization Structure APIs

JWT required, `role_id=4` blocked:

- `/departments` (GET/POST/GET:id/PUT/PATCH/DELETE)
- `/designations` (GET/POST/GET:id/PUT/PATCH/DELETE)
- `/locations` (GET/POST/GET:id/PUT/PATCH/DELETE)

## 7. Master Data APIs

All read APIs require JWT.
Write APIs require `role_id=1` (owner).

Resources:

- `/roles`
- `/plans`
- `/languages`
- `/timezones`
- `/platforms`
- `/message-menu-items`

Pattern for each resource:

- `GET /resource`
- `POST /resource` (owner only)
- `GET /resource/:id`
- `PUT /resource/:id` (owner only)
- `PATCH /resource/:id` (owner only)
- `DELETE /resource/:id` (owner only)

## 8. Activity Log API (`/activity-logs`)

- `GET /activity-logs`
- JWT required
- `role_id=4` blocked
- Organization scoped

Useful query params:

- `organization_id`
- `user_id`
- `actor_id`
- `action`
- `status` (`success|failed|denied`)
- `is_successful` (`true|false`)
- `occurred_from`
- `occurred_to`
- `search`
- `limit`
- `offset`

## 9. Global Access APIs (`/global-access`)

Purpose:

- map global member user (`user_id`) to allowed org users (`allow_user_id`) per org (`org_id`)
- table: `global_access`

### 9.1 Access rules

- JWT required for all global-access endpoints.
- GET endpoints: any logged-in role can access.
- POST/PUT/PATCH/DELETE: `role_id=4` blocked.

### 9.2 Endpoints

- `GET /global-access`
- `GET /global-access/:id`
- `GET /global-access/allowed-users?org_id=2&user_id=9`
- `POST /global-access`
- `PUT /global-access/:id`
- `PATCH /global-access/:id`
- `DELETE /global-access/:id`

Activity log for write endpoints:

- `POST /global-access` -> `global_access.create`
- `PUT /global-access/:id` -> `global_access.update`
- `PATCH /global-access/:id` -> `global_access.patch`
- `DELETE /global-access/:id` -> `global_access.delete`

### 9.3 Data integrity rules

- `user_id` must exist in `users` and be `is_global_member = true`.
- `allow_user_id` must exist in `users`.
- `allow_user_id` must belong to same org (`org_id`) through `organization_members`.
- cross-organization mapping is blocked at DB level.

### 9.4 JSON examples

Create (`POST /global-access`) body:

```json
{
  "org_id": 2,
  "user_id": 9,
  "allow_user_id": 12,
  "status": "active"
}
```

Create response:

```json
{
  "status": "success",
  "message": "Global access created",
  "data": {
    "global_access_id": 5,
    "org_id": 2,
    "organization_name": "Demo Org",
    "user_id": 9,
    "global_user_name": "Amar",
    "global_user_email": "amar@vedsu.com",
    "allow_user_id": 12,
    "allow_user_name": "Ravi",
    "allow_user_email": "ravi@vedsu.com",
    "status": "active",
    "created_at": "2026-02-19T10:17:19.668Z",
    "updated_at": "2026-02-19T10:17:19.668Z"
  }
}
```

PUT URL:

```text
/global-access/5
```

PUT body:

```json
{
  "org_id": 2,
  "user_id": 9,
  "allow_user_id": 15,
  "status": "active"
}
```

PATCH URL:

```text
/global-access/5
```

PATCH body:

```json
{
  "status": "inactive"
}
```

DELETE URL:

```text
/global-access/5?org_id=2
```

GET allowed users by org+user:

```text
/global-access/allowed-users?org_id=2&user_id=9
```

Allowed users response example:

```json
{
  "status": "success",
  "message": "Allowed users for global member retrieved",
  "data": {
    "org_id": 2,
    "user_id": 9,
    "count": 2,
    "rows": [
      {
        "org_id": 2,
        "organization_name": "Demo Org",
        "user_id": 9,
        "global_user_name": "Amar",
        "global_user_email": "amar@vedsu.com",
        "allow_user_id": 12,
        "allow_user_name": "Ravi",
        "allow_user_email": "ravi@vedsu.com",
        "status": "active",
        "created_at": "2026-02-19T10:17:19.668Z",
        "updated_at": "2026-02-19T10:17:19.668Z"
      }
    ]
  }
}
```

## 9.5 Organization Message Menu Permissions (`/organization-message-menu-permissions`)

Access:

- `GET/POST/PUT/PATCH`: JWT required + `role_id=4` blocked

Endpoints:

- `GET /organization-message-menu-permissions`
- `GET /organization-message-menu-permissions/:id`
- `POST /organization-message-menu-permissions`
- `PUT /organization-message-menu-permissions/:id`
- `PATCH /organization-message-menu-permissions/:id`

Validation:

- `permission_type`: `show|hide|disable`
- `status`: `active|inactive`
- `organization_id` pass karne ki zaroorat nahi; org context login token (`req.user.org`) se aata hai.

Example create body:

```json
{
  "menu_item_id": 5,
  "permission_type": "hide",
  "note": "Hide delete action for this org",
  "status": "active"
}
```

## 9.6 Plan Features (`/plan-features`)

Access:

- `GET` endpoints: public
- `POST/PUT/PATCH`: owner only (`role_id=1`)

Endpoints:

- `GET /plan-features`
- `GET /plan-features/:id`
- `GET /plan-features/plan/:planId/summary?status=all|active|inactive`
- `POST /plan-features`
- `PUT /plan-features/:id`
- `PATCH /plan-features/:id`

Summary endpoint returns:

- plan details (`plan_id`, `plan_key`, `plan_name`, `status`, limits, pricing)
- counts (`total`, `active`, `inactive`, `filtered`)
- features list based on selected status filter

Example create body:

```json
{
  "plan_id": 1,
  "feature_name": "One-One Messaging",
  "feature_description": "Direct secure one-to-one chat",
  "feature_icon": "chat",
  "section_label": "Plan Features",
  "display_order": 1,
  "status": "active"
}
```

## 9.7 Site Details (`/site-details`)

Access:

- `GET` endpoints: public
- `POST/PUT/PATCH`: owner only (`role_id=1`)

Endpoints:

- `GET /site-details`
- `GET /site-details/:id`
- `POST /site-details`
- `PUT /site-details/:id`
- `PATCH /site-details/:id`

Notes:

- `organization_id` is no longer present in the `site_details` table.
- `GET /site-details` sab site detail records return karta hai.
- `PUT` full update ke liye, `PATCH` partial update ke liye use karein.

PUT example body:

```json
{
  "brand_name": "TeamChatX Global",
  "logo_url": "https://cdn.example.com/logo-new.png",
  "mascot_url": "https://cdn.example.com/mascot-new.png",
  "linkedin_url": "https://linkedin.com/company/teamchatx-global",
  "twitter_url": "https://x.com/teamchatxglobal",
  "youtube_url": "https://youtube.com/@teamchatxglobal",
  "status": "active",
  "emails": [
    {
      "email_address": "support@teamchatx.com",
      "label": "support",
      "is_primary": true,
      "status": "active"
    }
  ],
  "phones": [
    {
      "phone_number": "+919876543210",
      "label": "main",
      "is_primary": true,
      "status": "active"
    }
  ],
  "addresses": [
    {
      "label": "HQ",
      "address_line_1": "Sector 62",
      "city": "Noida",
      "state": "Uttar Pradesh",
      "country": "India",
      "postal_code": "201301",
      "is_primary": true,
      "status": "active"
    }
  ]
}
```

PATCH example body:

```json
{
  "brand_name": "TeamChatX India",
  "twitter_url": "https://x.com/teamchatxindia"
}
```

## 9.8 Product Features (`/product-features`)

Access:

- `GET` endpoints: public
- `POST/PUT/PATCH`: owner only (`role_id=1`)

Endpoints:

- `GET /product-features/catalog`
- `GET /product-features/categories`
- `GET /product-features/categories/:categoryId`
- `POST /product-features/categories`
- `PUT /product-features/categories/:categoryId`
- `PATCH /product-features/categories/:categoryId`
- `GET /product-features`
- `GET /product-features/:id`
- `POST /product-features`
- `PUT /product-features/:id`
- `PATCH /product-features/:id`

Notes:

- `feature_categories` manages feature tabs (`messaging`, `group`, `audio_video`, etc.).
- `feature_items` manages points shown under each tab.
- `title` unique per `feature_category_id`.

Category create example:

```json
{
  "category_key": "messaging",
  "category_label": "MESSAGING",
  "display_order": 1,
  "status": "active"
}
```

Feature item create example:

```json
{
  "feature_category_id": 1,
  "title": "One-On-One Messaging",
  "description": "Chat instantly with one teammate.",
  "icon_url": "https://cdn.example.com/icons/one-to-one.svg",
  "display_order": 1,
  "status": "active"
}
```

Feature item patch example:

```json
{
  "description": "Updated text from admin panel",
  "status": "inactive"
}
```

## 9.9 Contact Us (`/contact-us`)

Access:

- `POST`: public (no JWT)
- `GET`: JWT required and `role_id=4` blocked

Endpoints:

- `POST /contact-us`
- `GET /contact-us`
- `GET /contact-us/:id`

Mail workflow:

- admin notification mail (`New Contact Us Request`) goes to `.env CONTACT_US_NOTIFY_TO`
- customer acknowledgement mail (`Thank you for contacting us`) goes to submitted `email_address`
- mail dispatch async/background hai, isliye `POST /contact-us` response fast aata hai
- recommended env: `CONTACT_US_NOTIFY_TO=support@teamchatx.com`

Example `POST` body:

```json
{
  "name": "Ravi Kumar",
  "country_code": "+91",
  "mobile_number": "9876543210",
  "email_address": "ravi@example.com",
  "company_name": "Acme Pvt Ltd",
  "total_users": 120,
  "requirement_details": "Need secure team chat with admin controls."
}
```

## 9.10 Organization Restrictions (`/organization-restrictions`)

Access:

- `GET`: JWT required (any role)
- `POST/PUT/PATCH`: JWT required and `role_id=4` blocked

IP restriction endpoints:

- `GET /organization-restrictions/ip`
- `GET /organization-restrictions/ip/:id`
- `POST /organization-restrictions/ip`
- `PUT /organization-restrictions/ip/:id`
- `PATCH /organization-restrictions/ip/:id`

Platform restriction endpoints:

- `GET /organization-restrictions/platform`
- `GET /organization-restrictions/platform/:id`
- `POST /organization-restrictions/platform`
- `PUT /organization-restrictions/platform/:id`
- `PATCH /organization-restrictions/platform/:id`

Activity log actions:

- `organization_ip_restriction.create|update|patch`
- `organization_platform_restriction.create|update|patch`

Example IP `POST` body:

```json
{
  "ip_address": "203.0.113.10",
  "status": "active",
  "note": "HQ static IP"
}
```

Example platform `POST` body:

```json
{
  "platform_id": 3,
  "restriction_type": "block",
  "status": "active",
  "note": "Temporary policy"
}
```

## 10. Group APIs (`/groups`, `/group-members`, `/group-timeline`)

### 10.1 Access rules

- Read APIs require JWT (any role):
  - `GET /groups`
  - `GET /groups/:id`
  - `GET /group-members`
  - `GET /group-members/by-group-name`
  - `GET /group-members/:id`
  - `GET /group-timeline`
- Write APIs require JWT and block `role_id=4`:
  - `POST /groups`, `PUT /groups/:id`, `PATCH /groups/:id`
  - `POST /group-members`, `PUT /group-members/:id`, `PATCH /group-members/:id`

### 10.2 Groups endpoints

- `GET /groups`
- `GET /groups/:id`
- `POST /groups`
- `PUT /groups/:id`
- `PATCH /groups/:id`

Write payload notes:

- `group_name` required for `POST` and `PUT`.
- `organization_id` optional for `POST/PUT/PATCH`; if not sent, token org (`req.user.org`) is used.
- `group_name` must be unique within same `organization_id` (case-insensitive, trimmed).

Example `POST /groups` body:

```json
{
  "group_name": "Aabhyasa Development",
  "group_description": "Main dev group",
  "group_image": null,
  "is_airtime": false,
  "status": "active"
}
```

### 10.3 Group members endpoints

- `GET /group-members`
- `GET /group-members/by-group-name`
- `GET /group-members/:id`
- `POST /group-members`
- `PUT /group-members/:id`
- `PATCH /group-members/:id`

Example `POST /group-members` body:

```json
{
  "group_id": 1,
  "user_id": 5,
  "is_admin": false,
  "status": "active"
}
```

Validation rules on member write:

- `organization_id` optional; defaults from token org.
- `group_id` must belong to same organization.
- `user_id` must be active member of same organization (`organization_members.status='active'`).
- member create is blocked if group status is not `active`.

`GET /group-members/by-group-name` query params:

- `group_name` (required)
- `organization_id` (optional)
- `status` (optional)
- `limit`, `offset` (optional)

`GET /group-members/by-group-name` response fields per row:

- `group_member_id`, `group_id`, `group_name`, `organization_id`
- `user_id`, `name`, `email`
- `is_admin`, `member_status`

### 10.4 Group timeline endpoint

- `GET /group-timeline`
- query params: `group_id`, `organization_id`, `event_type`, `status`, `limit`, `offset`

Auto timeline events:

- `group_created`, `group_updated`, `group_patched`
- `member_added`, `member_updated`, `member_patched`

Activity log actions for groups:

- `group.create`, `group.update`, `group.patch`
- `group_member.create`, `group_member.update`, `group_member.patch`

## 11. Common Error Messages

- `Unauthorized` (401): missing/invalid JWT
- `Access denied` (403): blocked by role middleware
- `Access denied for requested organization` (403): requester is not active member of requested org
- `Global access mapping already exists` (409)
- `Invalid allow_user_id: user does not exist` (400)
- `Invalid allow_user_id: user does not belong to the requested organization` (400)
- `Invalid user_id: global member user does not exist` (400)
- `Invalid org_id: organization does not exist` (400)
- `organization_id is required (body or login token org)` (400)
- `organization_id must match the group organization` (400)
- `user_id is not an active member of this organization` (400)
- `Cannot add member: group is not active` (400)
- `User is already a member of this group` (409)
- `group_name query is required` (400)
- `Group name already exists in this organization` (409)
- `Invalid OTP. Attempt X/5. Y attempts left` (HTTP 200 + `status=error`)
- `Maximum OTP attempts reached. Contact support for reset password.` (HTTP 200 + `status=error`)

## 12. Route Summary Table

- `/health`: GET (public)
- `/auth/*`: mixed public + JWT
- `/users/*`: mostly JWT + `role_id=4` blocked
- `/departments/*`: JWT + `role_id=4` blocked
- `/designations/*`: JWT + `role_id=4` blocked
- `/locations/*`: JWT + `role_id=4` blocked
- `/activity-logs/*`: JWT + `role_id=4` blocked
- `/global-access/*`: JWT (GET all roles), write blocked for `role_id=4`
- `/groups/*`: read JWT (all roles), write JWT + `role_id=4` blocked
- `/group-members/*`: read JWT (all roles), write JWT + `role_id=4` blocked
- `/group-timeline/*`: read JWT (all roles)
- `/organization-message-menu-permissions/*`: JWT + `role_id=4` blocked (all methods)
- `/plan-features/*`: read JWT (all roles), write owner-only (`role_id=1`)
- `/product-features/*`: read public, write owner-only (`role_id=1`)
- `/site-details/*`: read public, write owner-only (`role_id=1`)
- `/contact-us`: POST public, GET JWT with `role_id=4` blocked
- `/plans`: read public, owner-only write
- `/roles|languages|timezones|platforms|message-menu-items`: JWT read, owner-only write

## 13. Mail Templates

Mail templates are separated from controllers and kept in:

- `src/templates/mail/index.js`
- `src/templates/mail/README.md`

Individual template files:

- `src/templates/mail/auth/verificationOtpTemplate.js`
- `src/templates/mail/auth/forgotPasswordOtpTemplate.js`
- `src/templates/mail/auth/passwordResetSuccessTemplate.js`
- `src/templates/mail/orgUser/accountCreatedTemplate.js`
- `src/templates/mail/orgUser/passwordResetTemplate.js`
- `src/templates/mail/contactUs/adminNotificationTemplate.js`
- `src/templates/mail/contactUs/customerAcknowledgementTemplate.js`

---

## Appendix: API to Model Mapping

Is section me endpoint-wise exact `route -> middleware -> controller -> model/data-layer` mapping diya gaya hai.

Total endpoints mapped: see table below (includes core APIs; latest group APIs are documented in Section 10 and Route Summary).

| Method | API                              | Route File                              | Middleware Chain (order wise)                                                                                                                                                                                                                | Controller Handler                                     | Controller File                                  | Model Function Calls                                                                                                                                                                                                                                                                                                                                                                                                            | Model Function Use (Kya kaam hai)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/activity-logs`               | `src/routes/activityLogRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `activityLogController.getActivityLogs`              | `src/controllers/activityLogController.js`     | activityLogModel.findActivityLogs (src/models/activityLogModel.js)                                                                                                                                                                                                                                                                                                                                                              | activityLogModel.findActivityLogs: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                               |
| POST   | `/auth/create-account`         | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.createNewAccount`                    | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/forgot-password`        | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.forgotPassword`                      | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/forgot-verify`          | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.verifyForgotPasswordOtp`             | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/login`                  | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.login`                               | `src/controllers/authController.js`            | userModel.findByEmailWithMembership (src/models/userModel.js)`<br>`userDeviceModel.upsertDeviceForLogin (src/models/userDeviceModel.js)`<br>`sessionModel.createSession (src/models/sessionModel.js)                                                                                                                                                                                                                        | userModel.findByEmailWithMembership: Record(s) read/list/fetch karna`<br>`userDeviceModel.upsertDeviceForLogin: Naya record create/upsert karna`<br>`sessionModel.createSession: Naya record create/upsert karna                                                                                                                                                                                                                                             |
| POST   | `/auth/change-password`        | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `authController.changePassword`                      | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/logout`                 | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `authController.logout`                              | `src/controllers/authController.js`            | sessionModel.findByTokenHash (src/models/sessionModel.js)`<br>`sessionModel.revokeByTokenHash (src/models/sessionModel.js)`<br>`sessionModel.revokeActiveByUserAndDevice (src/models/sessionModel.js)`<br>`sessionModel.countActiveByDevice (src/models/sessionModel.js)`<br>`userDeviceModel.findByClientDeviceId (src/models/userDeviceModel.js)`<br>`userDeviceModel.markLoggedOut (src/models/userDeviceModel.js) | sessionModel.findByTokenHash: Record(s) read/list/fetch karna`<br>`sessionModel.revokeByTokenHash: Record/session remove ya revoke karna`<br>`sessionModel.revokeActiveByUserAndDevice: Record/session remove ya revoke karna`<br>`sessionModel.countActiveByDevice: Record(s) read/list/fetch karna`<br>`userDeviceModel.findByClientDeviceId: Record(s) read/list/fetch karna`<br>`userDeviceModel.markLoggedOut: Data layer operation execute karna |
| POST   | `/auth/logout-all`             | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `authController.logoutAll`                           | `src/controllers/authController.js`            | sessionModel.revokeAllActiveByUser (src/models/sessionModel.js)`<br>`userDeviceModel.markAllLoggedOutByUser (src/models/userDeviceModel.js)                                                                                                                                                                                                                                                                                   | sessionModel.revokeAllActiveByUser: Record/session remove ya revoke karna`<br>`userDeviceModel.markAllLoggedOutByUser: Existing record update karna                                                                                                                                                                                                                                                                                                            |
| GET    | `/auth/me`                     | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `authController.me`                                  | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/auth/organization-details`   | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `authController.getOrganizationDetails`              | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/refresh`                | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.refresh`                             | `src/controllers/authController.js`            | sessionModel.findByTokenHash (src/models/sessionModel.js)`<br>`sessionModel.revokeById (src/models/sessionModel.js)`<br>`userModel.findByIdWithMembership (src/models/userModel.js)`<br>`userDeviceModel.touchDevice (src/models/userDeviceModel.js)`<br>`userDeviceModel.upsertDeviceForLogin (src/models/userDeviceModel.js)`<br>`sessionModel.createSession (src/models/sessionModel.js)                           | sessionModel.findByTokenHash: Record(s) read/list/fetch karna`<br>`sessionModel.revokeById: Record/session remove ya revoke karna`<br>`userModel.findByIdWithMembership: Record(s) read/list/fetch karna`<br>`userDeviceModel.touchDevice: Existing record update karna`<br>`userDeviceModel.upsertDeviceForLogin: Naya record create/upsert karna`<br>`sessionModel.createSession: Naya record create/upsert karna                                    |
| POST   | `/auth/register`               | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.register`                            | `src/controllers/authController.js`            | userModel.findByEmailWithMembership (src/models/userModel.js)`<br>`userModel.createUser (src/models/userModel.js)                                                                                                                                                                                                                                                                                                             | userModel.findByEmailWithMembership: Record(s) read/list/fetch karna`<br>`userModel.createUser: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                |
| POST   | `/auth/resend-otp`             | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.resendOtp`                           | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/reset-password`         | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.resetPassword`                       | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/auth/user-details`           | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `authController.getUserDetails`                      | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/user-details`           | `src/routes/authRoutes.js`            | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `authController.getUserDetails`                      | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/auth/verify-otp`             | `src/routes/authRoutes.js`            | -                                                                                                                                                                                                                                            | `authController.verifyOtp`                           | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| DELETE | `/departments/:id`             | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `departmentController.deleteDepartment`              | `src/controllers/departmentController.js`      | departmentModel.deleteDepartment (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                                | departmentModel.deleteDepartment: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                          |
| GET    | `/departments/:id`             | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `departmentController.getDepartment`                 | `src/controllers/departmentController.js`      | departmentModel.findById (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                                        | departmentModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| PATCH  | `/departments/:id`             | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDepartmentUpdate (src/middlewares/departmentValidation.js)                                                                                    | `departmentController.patchDepartment`               | `src/controllers/departmentController.js`      | departmentModel.updateDepartmentPartial (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                         | departmentModel.updateDepartmentPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                            |
| PUT    | `/departments/:id`             | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDepartmentUpdate (src/middlewares/departmentValidation.js)                                                                                    | `departmentController.updateDepartment`              | `src/controllers/departmentController.js`      | departmentModel.updateDepartmentPartial (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                         | departmentModel.updateDepartmentPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                            |
| GET    | `/departments`                 | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `departmentController.getDepartments`                | `src/controllers/departmentController.js`      | departmentModel.findAll (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                                         | departmentModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/departments`                 | `src/routes/departmentRoutes.js`      | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDepartmentPayload (src/middlewares/departmentValidation.js)                                                                                   | `departmentController.createDepartment`              | `src/controllers/departmentController.js`      | departmentModel.createDepartment (src/models/departmentModel.js)                                                                                                                                                                                                                                                                                                                                                                | departmentModel.createDepartment: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                |
| DELETE | `/designations/:id`            | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `designationController.deleteDesignation`            | `src/controllers/designationController.js`     | designationModel.deleteDesignation (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                             | designationModel.deleteDesignation: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                        |
| GET    | `/designations/:id`            | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `designationController.getDesignation`               | `src/controllers/designationController.js`     | designationModel.findById (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                                      | designationModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                       |
| PATCH  | `/designations/:id`            | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDesignationUpdate (src/middlewares/designationValidation.js)                                                                                  | `designationController.patchDesignation`             | `src/controllers/designationController.js`     | designationModel.updateDesignationPartial (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                      | designationModel.updateDesignationPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                          |
| PUT    | `/designations/:id`            | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDesignationUpdate (src/middlewares/designationValidation.js)                                                                                  | `designationController.updateDesignation`            | `src/controllers/designationController.js`     | designationModel.updateDesignationPartial (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                      | designationModel.updateDesignationPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                          |
| GET    | `/designations`                | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `designationController.getDesignations`              | `src/controllers/designationController.js`     | designationModel.findAll (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                                       | designationModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| POST   | `/designations`                | `src/routes/designationRoutes.js`     | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateDesignationPayload (src/middlewares/designationValidation.js)                                                                                 | `designationController.createDesignation`            | `src/controllers/designationController.js`     | designationModel.createDesignation (src/models/designationModel.js)                                                                                                                                                                                                                                                                                                                                                             | designationModel.createDesignation: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                              |
| DELETE | `/global-access/:id`           | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `globalAccessController.deleteGlobalAccess`          | `src/controllers/globalAccessController.js`    | globalAccessModel.deleteGlobalAccess (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                                                                                                          | globalAccessModel.deleteGlobalAccess: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                      |
| GET    | `/global-access/:id`           | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `globalAccessController.getGlobalAccess`             | `src/controllers/globalAccessController.js`    | globalAccessModel.getGlobalAccessById (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                                                                                                         | globalAccessModel.getGlobalAccessById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                           |
| PATCH  | `/global-access/:id`           | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validatePatchGlobalAccess (src/middlewares/globalAccessValidation.js)                                                                                 | `globalAccessController.patchGlobalAccess`           | `src/controllers/globalAccessController.js`    | globalAccessModel.getGlobalAccessById (src/models/globalAccessModel.js)`<br>`globalAccessModel.patchGlobalAccess (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                            | globalAccessModel.getGlobalAccessById: Record(s) read/list/fetch karna`<br>`globalAccessModel.patchGlobalAccess: Existing record update karna                                                                                                                                                                                                                                                                                                                  |
| PUT    | `/global-access/:id`           | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validatePutGlobalAccess (src/middlewares/globalAccessValidation.js)                                                                                   | `globalAccessController.updateGlobalAccess`          | `src/controllers/globalAccessController.js`    | globalAccessModel.getGlobalAccessById (src/models/globalAccessModel.js)`<br>`globalAccessModel.updateGlobalAccess (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                           | globalAccessModel.getGlobalAccessById: Record(s) read/list/fetch karna`<br>`globalAccessModel.updateGlobalAccess: Existing record update karna                                                                                                                                                                                                                                                                                                                 |
| GET    | `/global-access/allowed-users` | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `globalAccessController.getAllowedUsersByOrgAndUser` | `src/controllers/globalAccessController.js`    | globalAccessModel.getAllowedUsersByOrgAndUser (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                                                                                                 | globalAccessModel.getAllowedUsersByOrgAndUser: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                   |
| GET    | `/global-access`               | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `globalAccessController.getGlobalAccesses`           | `src/controllers/globalAccessController.js`    | globalAccessModel.getGlobalAccesses (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                                                                                                           | globalAccessModel.getGlobalAccesses: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                             |
| POST   | `/global-access`               | `src/routes/globalAccessRoutes.js`    | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateCreateGlobalAccess (src/middlewares/globalAccessValidation.js)                                                                                | `globalAccessController.createGlobalAccess`          | `src/controllers/globalAccessController.js`    | globalAccessModel.createGlobalAccess (src/models/globalAccessModel.js)                                                                                                                                                                                                                                                                                                                                                          | globalAccessModel.createGlobalAccess: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                            |
| GET    | `/health`                      | `src/app.js`                          | -                                                                                                                                                                                                                                            | `inline handler`                                     | `src/app.js`                                   | -                                                                                                                                                                                                                                                                                                                                                                                                                               | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| DELETE | `/languages/:id`               | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `languageController.deleteLanguage`                  | `src/controllers/languageController.js`        | languageModel.deleteLanguage (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                                      | languageModel.deleteLanguage: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/languages/:id`               | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `languageController.getLanguage`                     | `src/controllers/languageController.js`        | languageModel.findById (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                                            | languageModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                          |
| PATCH  | `/languages/:id`               | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateLanguageUpdate (src/middlewares/languageValidation.js)`<br>`ensureUniqueLanguageCode (src/middlewares/languageValidation.js)           | `languageController.patchLanguage`                   | `src/controllers/languageController.js`        | languageModel.updateLanguagePartial (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                               | languageModel.updateLanguagePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| PUT    | `/languages/:id`               | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateLanguageUpdate (src/middlewares/languageValidation.js)`<br>`ensureUniqueLanguageCode (src/middlewares/languageValidation.js)           | `languageController.updateLanguage`                  | `src/controllers/languageController.js`        | languageModel.updateLanguagePartial (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                               | languageModel.updateLanguagePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| GET    | `/languages`                   | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `languageController.getLanguages`                    | `src/controllers/languageController.js`        | languageModel.findAll (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                                             | languageModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/languages`                   | `src/routes/languageRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateLanguagePayload (src/middlewares/languageValidation.js)`<br>`ensureUniqueLanguageCode (src/middlewares/languageValidation.js)          | `languageController.createLanguage`                  | `src/controllers/languageController.js`        | languageModel.createLanguage (src/models/languageModel.js)                                                                                                                                                                                                                                                                                                                                                                      | languageModel.createLanguage: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                    |
| DELETE | `/locations/:id`               | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `locationController.deleteLocation`                  | `src/controllers/locationController.js`        | locationModel.deleteLocation (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                                      | locationModel.deleteLocation: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/locations/:id`               | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `locationController.getLocation`                     | `src/controllers/locationController.js`        | locationModel.findById (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                                            | locationModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                          |
| PATCH  | `/locations/:id`               | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateLocationUpdate (src/middlewares/locationValidation.js)                                                                                        | `locationController.patchLocation`                   | `src/controllers/locationController.js`        | locationModel.updateLocationPartial (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                               | locationModel.updateLocationPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| PUT    | `/locations/:id`               | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateLocationUpdate (src/middlewares/locationValidation.js)                                                                                        | `locationController.updateLocation`                  | `src/controllers/locationController.js`        | locationModel.updateLocationPartial (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                               | locationModel.updateLocationPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| GET    | `/locations`                   | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `locationController.getLocations`                    | `src/controllers/locationController.js`        | locationModel.findAll (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                                             | locationModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/locations`                   | `src/routes/locationRoutes.js`        | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateLocationPayload (src/middlewares/locationValidation.js)                                                                                       | `locationController.createLocation`                  | `src/controllers/locationController.js`        | locationModel.createLocation (src/models/locationModel.js)                                                                                                                                                                                                                                                                                                                                                                      | locationModel.createLocation: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                    |
| DELETE | `/message-menu-items/:id`      | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `messageMenuItemController.deleteMenuItem`           | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.deleteMenuItem (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                        | messageMenuItemModel.deleteMenuItem: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                       |
| GET    | `/message-menu-items/:id`      | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `messageMenuItemController.getMenuItem`              | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.findById (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                              | messageMenuItemModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                   |
| PATCH  | `/message-menu-items/:id`      | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateMenuItemUpdate (src/middlewares/messageMenuItemValidation.js)`<br>`ensureUniqueMenuKey (src/middlewares/messageMenuItemValidation.js)  | `messageMenuItemController.patchMenuItem`            | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.updateMenuItemPartial (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                 | messageMenuItemModel.updateMenuItemPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                         |
| PUT    | `/message-menu-items/:id`      | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateMenuItemUpdate (src/middlewares/messageMenuItemValidation.js)`<br>`ensureUniqueMenuKey (src/middlewares/messageMenuItemValidation.js)  | `messageMenuItemController.updateMenuItem`           | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.updateMenuItemPartial (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                 | messageMenuItemModel.updateMenuItemPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                         |
| GET    | `/message-menu-items`          | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `messageMenuItemController.getMenuItems`             | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.findAll (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                               | messageMenuItemModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                    |
| POST   | `/message-menu-items`          | `src/routes/messageMenuItemRoutes.js` | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateMenuItemPayload (src/middlewares/messageMenuItemValidation.js)`<br>`ensureUniqueMenuKey (src/middlewares/messageMenuItemValidation.js) | `messageMenuItemController.createMenuItem`           | `src/controllers/messageMenuItemController.js` | messageMenuItemModel.createMenuItem (src/models/messageMenuItemModel.js)                                                                                                                                                                                                                                                                                                                                                        | messageMenuItemModel.createMenuItem: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                             |
| DELETE | `/plans/:id`                   | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `planController.deletePlan`                          | `src/controllers/planController.js`            | planModel.deletePlan (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                                  | planModel.deletePlan: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                                      |
| GET    | `/plans/:id`                   | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `planController.getPlan`                             | `src/controllers/planController.js`            | planModel.findById (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                                    | planModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                              |
| PATCH  | `/plans/:id`                   | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlanUpdate (src/middlewares/planValidation.js)`<br>`ensureUniquePlanKey (src/middlewares/planValidation.js)                            | `planController.patchPlan`                           | `src/controllers/planController.js`            | planModel.updatePlanPartial (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                           | planModel.updatePlanPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| PUT    | `/plans/:id`                   | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlanUpdate (src/middlewares/planValidation.js)`<br>`ensureUniquePlanKey (src/middlewares/planValidation.js)                            | `planController.updatePlan`                          | `src/controllers/planController.js`            | planModel.updatePlanPartial (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                           | planModel.updatePlanPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| GET    | `/plans`                       | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `planController.getPlans`                            | `src/controllers/planController.js`            | planModel.findAll (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                                     | planModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                               |
| POST   | `/plans`                       | `src/routes/planRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlanPayload (src/middlewares/planValidation.js)`<br>`ensureUniquePlanKey (src/middlewares/planValidation.js)                           | `planController.createPlan`                          | `src/controllers/planController.js`            | planModel.createPlan (src/models/planModel.js)                                                                                                                                                                                                                                                                                                                                                                                  | planModel.createPlan: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                            |
| DELETE | `/platforms/:id`               | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `platformController.deletePlatform`                  | `src/controllers/platformController.js`        | platformModel.deletePlatform (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                                      | platformModel.deletePlatform: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/platforms/:id`               | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `platformController.getPlatform`                     | `src/controllers/platformController.js`        | platformModel.findById (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                                            | platformModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                          |
| PATCH  | `/platforms/:id`               | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlatformUpdate (src/middlewares/platformValidation.js)`<br>`ensureUniquePlatformKey (src/middlewares/platformValidation.js)            | `platformController.patchPlatform`                   | `src/controllers/platformController.js`        | platformModel.updatePlatformPartial (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                               | platformModel.updatePlatformPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| PUT    | `/platforms/:id`               | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlatformUpdate (src/middlewares/platformValidation.js)`<br>`ensureUniquePlatformKey (src/middlewares/platformValidation.js)            | `platformController.updatePlatform`                  | `src/controllers/platformController.js`        | platformModel.updatePlatformPartial (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                               | platformModel.updatePlatformPartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| GET    | `/platforms`                   | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `platformController.getPlatforms`                    | `src/controllers/platformController.js`        | platformModel.findAll (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                                             | platformModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/platforms`                   | `src/routes/platformRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validatePlatformPayload (src/middlewares/platformValidation.js)`<br>`ensureUniquePlatformKey (src/middlewares/platformValidation.js)           | `platformController.createPlatform`                  | `src/controllers/platformController.js`        | platformModel.createPlatform (src/models/platformModel.js)                                                                                                                                                                                                                                                                                                                                                                      | platformModel.createPlatform: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                    |
| DELETE | `/roles/:id`                   | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `roleController.deleteRole`                          | `src/controllers/roleController.js`            | roleModel.deleteRole (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                                  | roleModel.deleteRole: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                                      |
| GET    | `/roles/:id`                   | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `roleController.getRole`                             | `src/controllers/roleController.js`            | roleModel.findById (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                                    | roleModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                              |
| PATCH  | `/roles/:id`                   | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateRoleUpdate (src/middlewares/roleValidation.js)`<br>`ensureUniqueRoleKey (src/middlewares/roleValidation.js)                            | `roleController.patchRole`                           | `src/controllers/roleController.js`            | roleModel.updateRolePartial (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                           | roleModel.updateRolePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| PUT    | `/roles/:id`                   | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateRoleUpdate (src/middlewares/roleValidation.js)`<br>`ensureUniqueRoleKey (src/middlewares/roleValidation.js)                            | `roleController.updateRole`                          | `src/controllers/roleController.js`            | roleModel.updateRolePartial (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                           | roleModel.updateRolePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                        |
| GET    | `/roles`                       | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `roleController.getRoles`                            | `src/controllers/roleController.js`            | roleModel.findAll (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                                     | roleModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                               |
| POST   | `/roles`                       | `src/routes/roleRoutes.js`            | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateRolePayload (src/middlewares/roleValidation.js)`<br>`ensureUniqueRoleKey (src/middlewares/roleValidation.js)                           | `roleController.createRole`                          | `src/controllers/roleController.js`            | roleModel.createRole (src/models/roleModel.js)                                                                                                                                                                                                                                                                                                                                                                                  | roleModel.createRole: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                            |
| DELETE | `/timezones/:id`               | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)                                                                                                                                                         | `timezoneController.deleteTimezone`                  | `src/controllers/timezoneController.js`        | timezoneModel.deleteTimezone (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                                      | timezoneModel.deleteTimezone: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/timezones/:id`               | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `timezoneController.getTimezone`                     | `src/controllers/timezoneController.js`        | timezoneModel.findById (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                                            | timezoneModel.findById: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                          |
| PATCH  | `/timezones/:id`               | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateTimezoneUpdate (src/middlewares/timezoneValidation.js)`<br>`ensureUniqueTimezoneCode (src/middlewares/timezoneValidation.js)           | `timezoneController.patchTimezone`                   | `src/controllers/timezoneController.js`        | timezoneModel.updateTimezonePartial (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                               | timezoneModel.updateTimezonePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| PUT    | `/timezones/:id`               | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateTimezoneUpdate (src/middlewares/timezoneValidation.js)`<br>`ensureUniqueTimezoneCode (src/middlewares/timezoneValidation.js)           | `timezoneController.updateTimezone`                  | `src/controllers/timezoneController.js`        | timezoneModel.updateTimezonePartial (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                               | timezoneModel.updateTimezonePartial: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                                |
| GET    | `/timezones`                   | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)                                                                                                                                                                                                               | `timezoneController.getTimezones`                    | `src/controllers/timezoneController.js`        | timezoneModel.findAll (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                                             | timezoneModel.findAll: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/timezones`                   | `src/routes/timezoneRoutes.js`        | auth (src/middlewares/auth.js)`<br>`requireOwner (src/middlewares/requireOwner.js)`<br>`validateTimezonePayload (src/middlewares/timezoneValidation.js)`<br>`ensureUniqueTimezoneCode (src/middlewares/timezoneValidation.js)          | `timezoneController.createTimezone`                  | `src/controllers/timezoneController.js`        | timezoneModel.createTimezone (src/models/timezoneModel.js)                                                                                                                                                                                                                                                                                                                                                                      | timezoneModel.createTimezone: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                                    |
| PATCH  | `/users/:id/activate`          | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `orgUserController.activateUser`                     | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)`<br>`orgUserModel.activateUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna`<br>`orgUserModel.activateUserInOrganization: Existing record update karna                                                                                                                                                                                                                                                                                                            |
| PATCH  | `/users/:id/deactivate`        | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `orgUserController.deactivateUser`                   | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)`<br>`orgUserModel.deactivateUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                              | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna`<br>`orgUserModel.deactivateUserInOrganization: Existing record update karna                                                                                                                                                                                                                                                                                                          |
| DELETE | `/users/:id`                   | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `orgUserController.deleteUser`                       | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)`<br>`orgUserModel.softDeleteUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                              | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna`<br>`orgUserModel.softDeleteUserInOrganization: Record/session remove ya revoke karna                                                                                                                                                                                                                                                                                                 |
| GET    | `/users/:id`                   | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `orgUserController.getUser`                          | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                                                                                            | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                         |
| PATCH  | `/users/:id`                   | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateUpdateOrgUser (src/middlewares/orgUserValidation.js)                                                                                          | `orgUserController.updateUser`                       | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)`<br>`orgUserModel.updateUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                  | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna`<br>`orgUserModel.updateUserInOrganization: Existing record update karna                                                                                                                                                                                                                                                                                                              |
| PUT    | `/users/:id`                   | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateUpdateOrgUser (src/middlewares/orgUserValidation.js)                                                                                          | `orgUserController.updateUser`                       | `src/controllers/orgUserController.js`         | orgUserModel.findUserByIdInOrganization (src/models/orgUserModel.js)`<br>`orgUserModel.updateUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                  | orgUserModel.findUserByIdInOrganization: Record(s) read/list/fetch karna`<br>`orgUserModel.updateUserInOrganization: Existing record update karna                                                                                                                                                                                                                                                                                                              |
| PATCH  | `/users/bulk`                  | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateBulkUpdateOrgUsers (src/middlewares/orgUserValidation.js)                                                                                     | `orgUserController.bulkUpdateUsers`                  | `src/controllers/orgUserController.js`         | orgUserModel.bulkUpdateUsersInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                                                                                         | orgUserModel.bulkUpdateUsersInOrganization: Existing record update karna                                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/users/forgot-password`       | `src/routes/orgUserRoutes.js`         | -                                                                                                                                                                                                                                            | `authController.forgotPassword`                      | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/users/forgot-verify`         | `src/routes/orgUserRoutes.js`         | -                                                                                                                                                                                                                                            | `authController.verifyForgotPasswordOtp`             | `src/controllers/authController.js`            | db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                                                                                                          | db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/users/reset-password`        | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateResetOrgUserPassword (src/middlewares/orgUserValidation.js)                                                                                   | `orgUserController.resetUserPassword`                | `src/controllers/orgUserController.js`         | orgUserModel.resetUserPasswordByEmailInOrganization (src/models/orgUserModel.js)`<br>`db.query / db.withTransaction (src/config/database.js)                                                                                                                                                                                                                                                                                  | orgUserModel.resetUserPasswordByEmailInOrganization: Existing record update karna`<br>`db.query / db.withTransaction: Custom SQL transaction/query chalana                                                                                                                                                                                                                                                                                                     |
| GET    | `/users`                       | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]                                                                                                                                                              | `orgUserController.getUsers`                         | `src/controllers/orgUserController.js`         | orgUserModel.findUsersInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                                                                                               | orgUserModel.findUsersInOrganization: Record(s) read/list/fetch karna                                                                                                                                                                                                                                                                                                                                                                                            |
| POST   | `/users`                       | `src/routes/orgUserRoutes.js`         | auth (src/middlewares/auth.js)`<br>`blockRole4 [derived: requireNotRoleId(4)]`<br>`validateCreateOrgUser (src/middlewares/orgUserValidation.js)                                                                                          | `orgUserController.createUser`                       | `src/controllers/orgUserController.js`         | orgUserModel.createUserInOrganization (src/models/orgUserModel.js)                                                                                                                                                                                                                                                                                                                                                              | orgUserModel.createUserInOrganization: Naya record create/upsert karna                                                                                                                                                                                                                                                                                                                                                                                           |

Notes:

- Middleware order exactly route definition ke order me hai.
- `blockRole4` jaisi entries derived middleware hain (factory function call se).
- `Model Function Use` short purpose batata hai ki function read/create/update/delete ya transaction ke liye use hua hai.

## Update Log (2026-02-25)

- Mail templates are centralized under `src/templates/mail/*`.
- Contact Us flow includes admin notify (`CONTACT_US_NOTIFY_TO`) and customer acknowledgement.
- Site Details/Product Features role matrix synced with current middleware.
- Added Organization Restrictions module docs with role rules and activity log actions.

## Update Log (2026-02-27)

- Added auth endpoint docs for `GET /auth/csrf` and trusted-device routes.
- Added refresh token reuse detection behavior (`force_logout_all`).
- Synced auth section numbering and secure-session notes with latest controller logic.

## Update Log (2026-03-02)

- Designation uniqueness rule documented as:
  - unique per organization + department + name.
  - cross-department same name allowed in same organization.
- Migration references synced with `021_designation_uniqueness_by_department.sql`.
- Global-access docs synced with global-member default permission use-case (chat-allow list management).

## Update Log (2026-03-09)

- Added complete billing flow docs: Step-1 quote, Step-2 address, Step-3 Stripe checkout + confirm.
- Added plan comparison endpoint details with `feature_items` join mapping.
- Added geo endpoints and coupon endpoint role matrix.
- Clarified login guard: users with non-active `organization_members.status` cannot login.

## Update Log (2026-03-09, Docs Sync 2)

- Billing route details expanded:
  - `GET /billing/address`
  - `GET /billing/addresses?limit=2`
  - `PUT /billing/address` with optional `create_new`
- Validation behavior updated:
  - manual `country` and `state` text values supported
  - `country_id` / `state_id` are optional
- Duplicate address persistence rule documented:
  - same active address is reused instead of inserting duplicate rows

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

- Documentation set refreshed for billing UX, payment history, invoice generation, activity logging, and shared subscription helpers.
- When future billing behavior changes, update `api.md`, `payment.md`, `migrations.md`, `database.md`, frontend docs, and mail-template docs in the same pass.
