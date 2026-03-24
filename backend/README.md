# TeamChatX API

Last updated: 2026-03-13

Node.js + Express MVC API with PostgreSQL, JWT auth, Redis cache, and SMTP email.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Core Features

- Account onboarding with organization creation (`/auth/create-account`)
- OTP verification, resend OTP, forgot/reset password
- JWT access + refresh token sessions
- Device tracking (`user_devices`) on login with trusted-device support (`client_device_id`)
- Organization-scoped user management (`/users`)
- Global-member access mapping via `global_access` (`org_id`, `user_id`, `allow_user_id`)
- Master data CRUD (`roles`, `plans`, `languages`, `timezones`, `platforms`, `message-menu-items`)
- Plan feature catalog (`/plan-features`) with plan summary endpoint
- Product feature catalog (`/product-features`) with category + tab item management
- Site details management (`/site-details`) with multi-email/phone/address support
- Contact request capture (`/contact-us`) from website form
- Organization restrictions:
  - IP restrictions (`/organization-restrictions/ip`)
  - Platform restrictions (`/organization-restrictions/platform`)
- Organization message menu permission overrides (`/organization-message-menu-permissions`)
- Org structure CRUD (`departments`, `designations`, `locations`)
- Group management (`/groups`) with timeline tracking (`/group-timeline`)
- Group member management (`/group-members`) including group-name based member listing
  - duplicate group-name creation in same organization is blocked
- Chat module (`/chat`): DM + group thread list, paginated messages, send/edit/delete, mark-read, multi-org support
- Organization profile module (`/organization`): overview, members, departments, designations, locations

## Environment Variables

```text
PORT=5000
NODE_ENV=development

DATABASE_URL=
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=teamChatx
DB_SSL=false
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=10000
DB_CONN_TIMEOUT_MS=5000

REDIS_URL=
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
REDIS_USERNAME=default
REDIS_PASSWORD=
REDIS_ENABLED=true
REDIS_CACHE_TTL=60
CACHE_TTL_SECONDS=60

JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=90d
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_LOCK_WINDOW_MINUTES=1
REFRESH_REUSE_GRACE_SECONDS=5
AUTH_RETURN_TOKENS_IN_BODY=false

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SECURITY_SUPPORT_EMAIL=support@teamchatx.com
SMTP_TIMEOUT_MS=5000
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
STRIPE_SECRET_KEY=
BILLING_CURRENCY_DEFAULT=INR
BILLING_USD_TO_INR=83.5
```

## Auth Header

```text
Authorization: Bearer <access_token>
```

## Role Access Matrix

- Public:
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
- JWT required:
  - `GET /auth/me`
  - `GET /auth/trusted-devices`
  - `POST /auth/trusted-devices/:deviceId/revoke`
  - `POST /auth/change-password`
  - `POST /auth/logout`
  - `POST /auth/logout-all`
- `role_id = 1` only:
  - All methods on `/roles`, `/languages`, `/timezones`, `/platforms`, `/message-menu-items`
  - Write methods on `/plans` (`POST`, `PUT`, `PATCH`, `DELETE`)
  - Write methods on `/plan-features` (`POST`, `PUT`, `PATCH`)
  - Write methods on `/product-features` (`POST`, `PUT`, `PATCH`)
  - Write methods on `/product-features/categories` (`POST`, `PUT`, `PATCH`)
  - Write methods on `/site-details` (`POST`, `PUT`, `PATCH`)
- Public:
  - `GET /plans`
  - `GET /plans/:id`
  - `GET /site-details`
  - `GET /site-details/:id`
  - `GET /product-features`
  - `GET /product-features/:id`
  - `GET /product-features/categories`
  - `GET /product-features/categories/:categoryId`
  - `GET /product-features/catalog`
- JWT required:
  - `GET /contact-us` (`role_id=4` blocked)
  - `GET /contact-us/:id` (`role_id=4` blocked)
- `role_id = 4` blocked (`403 Access denied`):
  - `/auth/user-details` (GET/POST)
  - `/auth/organization-details` (GET)
  - `/departments` (all)
  - `/designations` (all)
  - `/locations` (all)
  - `/users` protected routes (all)
  - `/activity-logs`
  - `/global-access` write routes only (`POST`, `PUT`, `PATCH`, `DELETE`)
  - `/groups` write routes (`POST`, `PUT`, `PATCH`)
  - `/group-members` write routes (`POST`, `PUT`, `PATCH`)
  - `/organization-message-menu-permissions` all routes (`GET`, `POST`, `PUT`, `PATCH`)

### Roles Master Snapshot

Current roles reference snapshot:

![Roles Table Snapshot](docs/image/database/1771936687102.png)

## API Groups

- Auth: `/auth/*`
- Master: `/roles`, `/plans`, `/languages`, `/timezones`, `/platforms`, `/message-menu-items`
- Plan Features: `/plan-features`
- Product Features: `/product-features`
- Site Details: `/site-details`
- Contact Us: `/contact-us`
- Organization Restrictions: `/organization-restrictions/ip`, `/organization-restrictions/platform`
- Organization Menu Permissions: `/organization-message-menu-permissions`
- Org Structure: `/departments`, `/designations`, `/locations`
- Org Users: `/users`
- Global Access: `/global-access`
- Activity Logs: `/activity-logs`
- Groups: `/groups`
- Group Members: `/group-members`
- Group Timeline: `/group-timeline`

## Update Log (2026-02-25)

- Mail templates moved to `src/templates/mail/*` and reused across controllers.
- Contact Us mail flow now sends:
  - admin notification to `.env CONTACT_US_NOTIFY_TO`
  - customer acknowledgement to submitted `email_address`
- `POST /contact-us` keeps response fast by dispatching mails asynchronously.
- Added organization restrictions module with role rules:
  - `GET`: JWT any role
  - `POST/PUT/PATCH`: `role_id=4` blocked
- Added activity-log tracking for restriction writes:
  - `organization_ip_restriction.create|update|patch`
  - `organization_platform_restriction.create|update|patch`

## Update Log (2026-02-27)

- Auth routes updated with:
  - `GET /auth/csrf`
  - `GET /auth/trusted-devices`
  - `POST /auth/trusted-devices/:deviceId/revoke`
- Security env knobs added:
  - `OTP_RESEND_COOLDOWN_SECONDS`
  - `OTP_LOCK_WINDOW_MINUTES`
  - `REFRESH_REUSE_GRACE_SECONDS`
  - `AUTH_RETURN_TOKENS_IN_BODY`
- Refresh flow now documents token-reuse detection (`force_logout_all` security logout).

## Route Workflow (Middleware + Validation)

Request pipeline format:
- `auth` = JWT token required
- `requireOwner` = only `role_id = 1`
- `blockRole4` = `requireNotRoleId(4)`
- `validate*` / `ensureUnique*` = request validation middlewares

### Auth Routes (`src/routes/authRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `POST /auth/register` | `authController.register` |
| `POST /auth/create-account` | `authController.createNewAccount` |
| `POST /auth/resend-otp` | `authController.resendOtp` |
| `POST /auth/forgot-password` | `authController.forgotPassword` |
| `POST /auth/forgot-verify` | `authController.verifyForgotPasswordOtp` |
| `POST /auth/reset-password` | `authController.resetPassword` |
| `POST /auth/change-password` | `auth -> authController.changePassword` |
| `POST /auth/verify-otp` | `authController.verifyOtp` |
| `POST /auth/login` | `authController.login` |
| `GET /auth/csrf` | `authController.getCsrfToken` |
| `POST /auth/refresh` | `authController.refresh` |
| `POST /auth/logout` | `auth -> authController.logout` |
| `POST /auth/logout-all` | `auth -> authController.logoutAll` |
| `GET /auth/trusted-devices` | `auth -> authController.listTrustedDevices` |
| `POST /auth/trusted-devices/:deviceId/revoke` | `auth -> authController.revokeTrustedDevice` |
| `GET /auth/me` | `auth -> authController.me` |
| `GET /auth/user-details` | `auth -> blockRole4 -> authController.getUserDetails` |
| `POST /auth/user-details` | `auth -> blockRole4 -> authController.getUserDetails` |
| `GET /auth/organization-details` | `auth -> blockRole4 -> authController.getOrganizationDetails` |

### Org User Routes (`src/routes/orgUserRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `POST /users/forgot-password` | `authController.forgotPassword` |
| `POST /users/forgot-verify` | `authController.verifyForgotPasswordOtp` |
| `GET /users` | `auth -> blockRole4 -> orgUserController.getUsers` |
| `POST /users` | `auth -> blockRole4 -> validateCreateOrgUser -> orgUserController.createUser` |
| `PATCH /users/bulk` | `auth -> blockRole4 -> validateBulkUpdateOrgUsers -> orgUserController.bulkUpdateUsers` |
| `POST /users/reset-password` | `auth -> blockRole4 -> validateResetOrgUserPassword -> orgUserController.resetUserPassword` |
| `GET /users/:id` | `auth -> blockRole4 -> orgUserController.getUser` |
| `PUT /users/:id` | `auth -> blockRole4 -> validateUpdateOrgUser -> orgUserController.updateUser` |
| `PATCH /users/:id` | `auth -> blockRole4 -> validateUpdateOrgUser -> orgUserController.updateUser` |
| `DELETE /users/:id` | `auth -> blockRole4 -> orgUserController.deleteUser` |
| `PATCH /users/:id/deactivate` | `auth -> blockRole4 -> orgUserController.deactivateUser` |
| `PATCH /users/:id/activate` | `auth -> blockRole4 -> orgUserController.activateUser` |

### Global Access Routes (`src/routes/globalAccessRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /global-access` | `auth -> globalAccessController.getGlobalAccesses` |
| `POST /global-access` | `auth -> blockRole4 -> validateCreateGlobalAccess -> globalAccessController.createGlobalAccess` |
| `GET /global-access/allowed-users` | `auth -> globalAccessController.getAllowedUsersByOrgAndUser` |
| `GET /global-access/:id` | `auth -> globalAccessController.getGlobalAccess` |
| `PUT /global-access/:id` | `auth -> blockRole4 -> validatePutGlobalAccess -> globalAccessController.updateGlobalAccess` |
| `PATCH /global-access/:id` | `auth -> blockRole4 -> validatePatchGlobalAccess -> globalAccessController.patchGlobalAccess` |
| `DELETE /global-access/:id` | `auth -> blockRole4 -> globalAccessController.deleteGlobalAccess` |

### Org Structure Routes

`src/routes/departmentRoutes.js`

| Route | Middleware Flow |
|---|---|
| `GET /departments` | `auth -> blockRole4 -> departmentController.getDepartments` |
| `POST /departments` | `auth -> blockRole4 -> validateDepartmentPayload -> departmentController.createDepartment` |
| `GET /departments/:id` | `auth -> blockRole4 -> departmentController.getDepartment` |
| `PUT/PATCH /departments/:id` | `auth -> blockRole4 -> validateDepartmentUpdate -> departmentController.update/patchDepartment` |
| `DELETE /departments/:id` | `auth -> blockRole4 -> departmentController.deleteDepartment` |

`src/routes/designationRoutes.js`

| Route | Middleware Flow |
|---|---|
| `GET /designations` | `auth -> blockRole4 -> designationController.getDesignations` |
| `POST /designations` | `auth -> blockRole4 -> validateDesignationPayload -> designationController.createDesignation` |
| `GET /designations/:id` | `auth -> blockRole4 -> designationController.getDesignation` |
| `PUT/PATCH /designations/:id` | `auth -> blockRole4 -> validateDesignationUpdate -> designationController.update/patchDesignation` |
| `DELETE /designations/:id` | `auth -> blockRole4 -> designationController.deleteDesignation` |

`src/routes/locationRoutes.js`

| Route | Middleware Flow |
|---|---|
| `GET /locations` | `auth -> blockRole4 -> locationController.getLocations` |
| `POST /locations` | `auth -> blockRole4 -> validateLocationPayload -> locationController.createLocation` |
| `GET /locations/:id` | `auth -> blockRole4 -> locationController.getLocation` |
| `PUT/PATCH /locations/:id` | `auth -> blockRole4 -> validateLocationUpdate -> locationController.update/patchLocation` |
| `DELETE /locations/:id` | `auth -> blockRole4 -> locationController.deleteLocation` |

### Master Routes (Owner Write Access)

Pattern for these route files:
- `src/routes/roleRoutes.js`
- `src/routes/planRoutes.js`
- `src/routes/languageRoutes.js`
- `src/routes/timezoneRoutes.js`
- `src/routes/platformRoutes.js`
- `src/routes/messageMenuItemRoutes.js`

Read routes:
- `GET /<resource>`
- `GET /<resource>/:id`
- flow: `auth -> controller` (except `/plans` read routes, which are public)

Write routes:
- `POST /<resource>`
- `PUT /<resource>/:id`
- `PATCH /<resource>/:id`
- `DELETE /<resource>/:id`
- flow: `auth -> requireOwner -> validate* -> ensureUnique* -> controller`

### Activity Log Route (`src/routes/activityLogRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /activity-logs` | `auth -> blockRole4 -> activityLogController.getActivityLogs` |

### Group Routes (`src/routes/groupRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /groups` | `auth -> groupController.getGroups` |
| `POST /groups` | `auth -> blockRole4 -> validateGroupPayload -> groupController.createGroup` |
| `GET /groups/:id` | `auth -> groupController.getGroup` |
| `PUT /groups/:id` | `auth -> blockRole4 -> validateGroupPut -> groupController.updateGroup` |
| `PATCH /groups/:id` | `auth -> blockRole4 -> validateGroupPatch -> groupController.patchGroup` |

### Group Member Routes (`src/routes/groupMemberRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /group-members` | `auth -> groupMemberController.getGroupMembers` |
| `GET /group-members/by-group-name` | `auth -> groupMemberController.getGroupMembersByGroupName` |
| `GET /group-members/:id` | `auth -> groupMemberController.getGroupMember` |
| `POST /group-members` | `auth -> blockRole4 -> validateCreateGroupMember -> groupMemberController.createGroupMember` |
| `PUT /group-members/:id` | `auth -> blockRole4 -> validatePutGroupMember -> groupMemberController.updateGroupMember` |
| `PATCH /group-members/:id` | `auth -> blockRole4 -> validatePatchGroupMember -> groupMemberController.patchGroupMember` |

### Group Timeline Route (`src/routes/groupTimelineRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /group-timeline` | `auth -> groupTimelineController.getGroupTimeline` |

### Organization Message Menu Permission Routes (`src/routes/organizationMessageMenuPermissionRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /organization-message-menu-permissions` | `auth -> blockRole4 -> organizationMessageMenuPermissionController.getPermissions` |
| `POST /organization-message-menu-permissions` | `auth -> blockRole4 -> validateCreatePermission -> organizationMessageMenuPermissionController.createPermission` |
| `GET /organization-message-menu-permissions/:id` | `auth -> blockRole4 -> organizationMessageMenuPermissionController.getPermission` |
| `PUT /organization-message-menu-permissions/:id` | `auth -> blockRole4 -> validatePutPermission -> organizationMessageMenuPermissionController.updatePermission` |
| `PATCH /organization-message-menu-permissions/:id` | `auth -> blockRole4 -> validatePatchPermission -> organizationMessageMenuPermissionController.patchPermission` |

### Plan Feature Routes (`src/routes/planFeatureRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /plan-features/plan/:planId/summary` | `auth -> planFeatureController.getPlanFeatureSummary` |
| `GET /plan-features` | `auth -> planFeatureController.getPlanFeatures` |
| `POST /plan-features` | `auth -> requireOwner -> validateCreatePlanFeature -> ensureUniquePlanFeature -> planFeatureController.createPlanFeature` |
| `GET /plan-features/:id` | `auth -> planFeatureController.getPlanFeature` |
| `PUT /plan-features/:id` | `auth -> requireOwner -> validateUpdatePlanFeature -> ensureUniquePlanFeature -> planFeatureController.updatePlanFeature` |
| `PATCH /plan-features/:id` | `auth -> requireOwner -> validateUpdatePlanFeature -> ensureUniquePlanFeature -> planFeatureController.patchPlanFeature` |

### Product Feature Routes (`src/routes/productFeatureRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /product-features/catalog` | `productFeatureController.getCatalog` |
| `GET /product-features/categories` | `productFeatureController.getCategories` |
| `POST /product-features/categories` | `auth -> requireOwner -> validateCreateCategory -> ensureUniqueCategoryKey -> productFeatureController.createCategory` |
| `GET /product-features/categories/:categoryId` | `productFeatureController.getCategoryById` |
| `PUT /product-features/categories/:categoryId` | `auth -> requireOwner -> validatePutCategory -> ensureUniqueCategoryKey -> productFeatureController.putCategory` |
| `PATCH /product-features/categories/:categoryId` | `auth -> requireOwner -> validatePatchCategory -> ensureUniqueCategoryKey -> productFeatureController.patchCategory` |
| `GET /product-features` | `productFeatureController.getItems` |
| `POST /product-features` | `auth -> requireOwner -> validateCreateItem -> ensureCategoryExists -> ensureUniqueItemTitlePerCategory -> productFeatureController.createItem` |
| `GET /product-features/:id` | `productFeatureController.getItemById` |
| `PUT /product-features/:id` | `auth -> requireOwner -> validatePutItem -> ensureCategoryExists -> ensureUniqueItemTitlePerCategory -> productFeatureController.putItem` |
| `PATCH /product-features/:id` | `auth -> requireOwner -> validatePatchItem -> ensureCategoryExists -> ensureUniqueItemTitlePerCategory -> productFeatureController.patchItem` |

### Site Detail Routes (`src/routes/siteDetailRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /site-details` | `siteDetailController.getSiteDetail` |
| `POST /site-details` | `auth -> requireOwner -> validateCreateSiteDetail -> siteDetailController.createSiteDetail` |
| `GET /site-details/:id` | `siteDetailController.getSiteDetailById` |
| `PUT /site-details/:id` | `auth -> requireOwner -> validateUpdateSiteDetail -> siteDetailController.updateSiteDetail` |
| `PATCH /site-details/:id` | `auth -> requireOwner -> validatePatchSiteDetail -> siteDetailController.patchSiteDetail` |

### Contact Us Routes (`src/routes/contactUsRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `POST /contact-us` | `validateCreateContactRequest -> contactUsController.createContactRequest` (public) |
| `GET /contact-us` | `auth -> blockRole4 -> contactUsController.getContactRequests` |
| `GET /contact-us/:id` | `auth -> blockRole4 -> contactUsController.getContactRequestById` |

### Chat Routes (`backend/src/chat/chatRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /chat/organizations` | `auth -> chatController.getOrganizations` |
| `GET /chat/threads` | `auth -> chatController.getThreads` |
| `GET /chat/contacts` | `auth -> chatController.getContacts` |
| `GET /chat/threads/:id/messages` | `auth -> chatController.getThreadMessages` |
| `POST /chat/threads/:id/messages` | `auth -> chatController.sendMessage` |
| `POST /chat/threads/:id/read` | `auth -> chatController.markRead` |
| `PATCH /chat/messages/:id` | `auth -> chatController.editMessage` |
| `DELETE /chat/messages/:id` | `auth -> chatController.deleteMessage` |

Notes:
- Thread ID format: `dm-{userId}` for DMs, `group-{groupId}` for groups.
- `GET /chat/threads` supports `?org_id=` query param for multi-org filtering.
- DM threads include: `email`, `mobile`, `designation`, `department`, `location` from org member data.
- Messages stored in: `messages` table (DMs) and `group_messages` + `group_message_recipients` tables (groups).
- JWT uses `sub` field for user ID (`req.user.sub`).

### Organization Profile Routes (`backend/src/routes/organizationProfileRoutes.js`)

| Route | Middleware Flow |
|---|---|
| `GET /organization/overview` | `auth -> organizationProfileController.getOverview` |
| `GET /organization/members` | `auth -> organizationProfileController.getMembers` |
| `GET /organization/members/:userId` | `auth -> organizationProfileController.getMember` |
| `GET /organization/departments` | `auth -> organizationProfileController.getDepartments` |
| `GET /organization/designations` | `auth -> organizationProfileController.getDesignations` |
| `GET /organization/locations` | `auth -> organizationProfileController.getLocations` |

### App-Level Middleware Order (`src/app.js`)

Global middlewares run in this order:
1. `helmet`
2. `cors`
3. `express.json`
4. `express.urlencoded`
5. `morgan` (except `NODE_ENV=test`)
6. route handlers
7. 404 handler
8. `errorHandler`

## Organization Users Endpoints

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PUT /users/:id`
- `PATCH /users/:id`
- `PATCH /users/bulk`
- `DELETE /users/:id` (soft delete)
- `PATCH /users/:id/deactivate`
- `PATCH /users/:id/activate`
- `POST /users/reset-password`

## Global Access Endpoints

- `GET /global-access`
- `GET /global-access/:id`
- `GET /global-access/allowed-users?org_id=2&user_id=9`
- `POST /global-access` (`role_id = 4` blocked)
- `PUT /global-access/:id` (`role_id = 4` blocked)
- `PATCH /global-access/:id` (`role_id = 4` blocked)
- `DELETE /global-access/:id` (`role_id = 4` blocked)

## Organization Message Menu Permissions Endpoints

- `GET /organization-message-menu-permissions` (`role_id = 4` blocked)
- `GET /organization-message-menu-permissions/:id` (`role_id = 4` blocked)
- `POST /organization-message-menu-permissions` (`role_id = 4` blocked)
- `PUT /organization-message-menu-permissions/:id` (`role_id = 4` blocked)
- `PATCH /organization-message-menu-permissions/:id` (`role_id = 4` blocked)

Organization context behavior:
- `organization_id` request me bhejne ki zaroorat nahi.
- API hamesha login token (`req.user.org`) wala organization use karegi.

Allowed values:
- `permission_type`: `show | hide | disable`
- `status`: `active | inactive`

Example `POST` body:

```json
{
  "menu_item_id": 5,
  "permission_type": "hide",
  "note": "Hide delete action for this org",
  "status": "active"
}
```

Example `PATCH` body:

```json
{
  "permission_type": "disable",
  "status": "inactive"
}
```

## Plan Features Endpoints

- `GET /plan-features`
- `GET /plan-features/:id`
- `GET /plan-features/plan/:planId/summary?status=all|active|inactive`
- `POST /plan-features` (`role_id = 1` only)
- `PUT /plan-features/:id` (`role_id = 1` only)
- `PATCH /plan-features/:id` (`role_id = 1` only)

## Site Details Endpoints

- `GET /site-details` (public)
- `GET /site-details/:id` (public)
- `POST /site-details` (`role_id = 1` only)
- `PUT /site-details/:id` (`role_id = 1` only)
- `PATCH /site-details/:id` (`role_id = 1` only)

## Product Features Endpoints

- `GET /product-features/catalog` (public)
- `GET /product-features/categories` (public)
- `GET /product-features/categories/:categoryId` (public)
- `POST /product-features/categories` (`role_id = 1` only)
- `PUT /product-features/categories/:categoryId` (`role_id = 1` only)
- `PATCH /product-features/categories/:categoryId` (`role_id = 1` only)
- `GET /product-features` (public)
- `GET /product-features/:id` (public)
- `POST /product-features` (`role_id = 1` only)
- `PUT /product-features/:id` (`role_id = 1` only)
- `PATCH /product-features/:id` (`role_id = 1` only)

## Contact Us Endpoints

- `POST /contact-us` (public, no JWT)
- `GET /contact-us` (JWT required, `role_id=4` blocked)
- `GET /contact-us/:id` (JWT required, `role_id=4` blocked)

Mail behavior on create:
- `POST /contact-us` ke baad 2 mails auto-send hote hain:
- admin notification mail (`New Contact Us Request`) -> `CONTACT_US_NOTIFY_TO` (recommended: `support@teamchatx.com`)
- customer acknowledgement mail (`Thank you for contacting us`) -> submitted `email_address`
- mails background me dispatch hote hain, isliye `POST /contact-us` response fast return hota hai.
- mail templates compact hain (only important fields) for cleaner UI.

Notes:
- `site_details` table me `organization_id` column removed hai.
- `GET /site-details` sab records return karta hai.

Example `PUT` body:

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

Example `PATCH` body:

```json
{
  "brand_name": "TeamChatX India",
  "twitter_url": "https://x.com/teamchatxindia"
}
```

Example `POST` body:

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

Example summary response intent:
- plan details
- counts (`total`, `active`, `inactive`, `filtered`)
- filtered feature list by `status`
- write activity logs on `POST`, `PUT`, `PATCH`

Activity log actions for latest modules:
- `organization_message_menu_permission.create`
- `organization_message_menu_permission.update`
- `organization_message_menu_permission.patch`
- `plan_feature.create`
- `plan_feature.update`
- `plan_feature.patch`

Global Access URL examples:

- PUT URL: `/global-access/5`
- PATCH URL: `/global-access/5`
- DELETE URL: `/global-access/5?org_id=2`

Global Access JSON examples:

PUT request body:

```json
{
  "org_id": 2,
  "user_id": 9,
  "allow_user_id": 15,
  "status": "active"
}
```

PUT response (example):

```json
{
  "status": "success",
  "message": "Global access updated",
  "data": {
    "global_access_id": 5,
    "org_id": 2,
    "user_id": 9,
    "allow_user_id": 15,
    "status": "active"
  }
}
```

PATCH request body:

```json
{
  "status": "inactive"
}
```

PATCH response (example):

```json
{
  "status": "success",
  "message": "Global access patched",
  "data": {
    "global_access_id": 5,
    "org_id": 2,
    "user_id": 9,
    "allow_user_id": 15,
    "status": "inactive"
  }
}
```

DELETE response (example):

```json
{
  "status": "success",
  "message": "Global access deleted",
  "data": {
    "global_access_id": 5,
    "org_id": 2,
    "user_id": 9,
    "allow_user_id": 15,
    "status": "inactive"
  }
}
```

## Activity Logs Endpoint

- `GET /activity-logs`
- JWT required, `role_id = 4` blocked
- Organization scoped access

Useful query params:

- `organization_id` (optional)
- `user_id` (actor ya target user ke logs)
- `actor_id`
- `action`
- `status` (`success|failed|denied`)
- `is_successful` (`true|false`)
- `occurred_from`
- `occurred_to`
- `search`
- `limit`
- `offset`

## Group Endpoints

Groups:
- `GET /groups`
- `GET /groups/:id`
- `POST /groups` (`role_id = 4` blocked)
- `PUT /groups/:id` (`role_id = 4` blocked)
- `PATCH /groups/:id` (`role_id = 4` blocked)

Group Members:
- `GET /group-members`
- `GET /group-members/by-group-name?group_name=Aabhyasa%20Development&organization_id=2&status=active&limit=10&offset=0`
- `GET /group-members/:id`
- `POST /group-members` (`role_id = 4` blocked)
- `PUT /group-members/:id` (`role_id = 4` blocked)
- `PATCH /group-members/:id` (`role_id = 4` blocked)

Group Timeline:
- `GET /group-timeline`
- query params: `group_id`, `organization_id`, `event_type`, `status`, `limit`, `offset`

Group create/member write notes:
- `organization_id` optional in `/groups` write payloads; defaults from JWT token org.
- `organization_id` optional in `/group-members` write payloads; defaults from JWT token org.
- `is_airtime` meaning in `groups`:
  - `true` => only admins or moderators can send messages, announcements, files, or updates in that group.
  - `false` => regular group messaging rules apply (not restricted by airtime mode).
- `group-members` write validates:
  - selected `group_id` belongs to same organization
  - `user_id` is active member in same organization
- timeline events auto-created:
  - `group_created`, `group_updated`, `group_patched`
  - `member_added`, `member_updated`, `member_patched`

## Notes

- `POST /users` default role logic:
  - if `role_id` not provided and `is_platform_admin = true` -> role `2`
  - if `role_id` not provided and `is_platform_admin = false` -> role `4`
- `global_access` table is for users where `users.is_global_member = true`.
  - `org_id`: organization context
  - `user_id`: global member user id
  - `allow_user_id`: org user id that this global member can access
  - `allow_user_id` must belong to same `org_id` (cross-organization access blocked at DB level)
- New user creation generates random temp password and emails it.
- Mail sending is optimized with pooled SMTP transport + async dispatch.

## JWT Session Strategy (Current)

Configured values:
- `JWT_EXPIRES_IN=15m` (access token)
- `JWT_REFRESH_EXPIRES_IN=90d` (refresh token)

How this works:
- access token short-lived hota hai and API auth ke liye use hota hai.
- refresh token long-lived hota hai and `POST /auth/refresh` se new access + new refresh token deta hai.
- frontend near-expiry pe auto refresh karta hai (90 din baad ka wait nahi karta).
- har successful refresh me refresh token rotate hota hai, so session window sliding pattern me extend hoti rehti hai jab tak user active hai.
- explicit logout (`/auth/logout` ya `/auth/logout-all`) session revoke karta hai.
- same trusted/known device (`client_device_id`) par logout ke baad login me OTP re-prompt nahi hota.
- OTP mainly new/unrecognized device login ke liye trigger hota hai.

Security note:
- 90-day refresh only tab secure hai jab server-side revoke + rotation + device scoping active ho (is project me active hai).

## Organization Details Endpoint

- `GET /auth/organization-details`
- JWT required, `role_id = 4` blocked
- Query:
  - `organization_id` (optional, default from token org)

Example request query:

```json
{
  "organization_id": 2
}
```

Example response:

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
      "status": "active"
    },
    "owner": {
      "owner_id": 1,
      "owner_name": "Owner User",
      "owner_email": "owner@vedsu.com"
    },
    "current_plan": {
      "plan_id": 1,
      "plan_name": "Basic",
      "subscription_status": "active",
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
      "global_members": 2,
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

## Documentation

- `docs/documentation.md` full API behavior and payloads
- `docs/api.md` complete API list with JSON examples
- `docs/database.md` schema and migrations
- `docs/migrations.md` how to run migrations step-by-step
- `docs/query.md` useful SQL queries
- `docs/command.md` psql commands
- `docs/features.md` backend feature map (security, auth, modules, architecture)

`docs/query.md` now includes query packs for:
- `/auth/organization-details`
- `/auth/me`
- `/global-access`
- activity log verification/debug

## Mail Templates (Centralized)

All email HTML/text templates are now centralized at:
- `src/templates/mail/README.md`
- `src/templates/mail/index.js`

Template files:
- `src/templates/mail/auth/verificationOtpTemplate.js`
- `src/templates/mail/auth/forgotPasswordOtpTemplate.js`
- `src/templates/mail/orgUser/accountCreatedTemplate.js`
- `src/templates/mail/orgUser/passwordResetTemplate.js`
- `src/templates/mail/contactUs/adminNotificationTemplate.js`
- `src/templates/mail/contactUs/customerAcknowledgementTemplate.js`

Performance note:
- run `migrations/007_performance_indexes.sql` for auth/users/global-access/activity-log heavy queries.
- run `migrations/008_activity_log_query_optimizations.sql` for additional activity-log filters.
- run `migrations/009_groups_and_related_tables.sql` to create groups/group_members/group_permissions/group_timeline tables.
- run `migrations/010_group_members_timeline_perf.sql` for group-members/group-timeline listing performance.
- run `migrations/011_groups_lookup_indexes.sql` for faster `/group-members/by-group-name` lookups.
- run `migrations/012_api_hotpath_indexes.sql` for faster `/users`, `/global-access`, `/departments`, `/designations`, `/locations` list APIs.
- run `migrations/013_org_message_menu_permissions.sql` for `organization_message_menu_permissions` table + indexes + status constraint.
- run `migrations/014_site_details.sql` for initial `site_details` + contacts tables.
- run `migrations/015_site_details_remove_organization_id_and_truncate.sql` to truncate site details data and remove `organization_id`.
- run `migrations/016_product_features.sql` for `feature_categories` and `feature_items` + seed feature tabs.
- run `migrations/017_contact_us.sql` for `contact_us_requests` table.
- run `migrations/022_countries_states_master.sql` for global `countries` and `states` master tables (250 countries, 4963 states seed).
- run `migrations/024_payment_history_billing_metadata.sql` to store billing-address/coupon/currency metadata in `payment_history`.
- run `migrations/030_reset_and_seed_plans_reasonable_pricing.sql` to reset and seed plan pricing.
- run `migrations/031_payment_history_strong_uniques.sql` to enforce strong payment-history uniqueness.
- run `migrations/032_payment_history_failure_reason_jsonb.sql` to add structured failure reason JSONB.
- run `migrations/033_reset_currencies_to_stripe_supported.sql` to reseed Stripe-supported currencies.
- run `migrations/034_drop_coupon_currency_code.sql` to remove coupon-level fixed currency column.
- run `migrations/035_seed_feature_items_full_catalog.sql` for complete product feature item catalog (all categories + coming soon tabs).

## Update Log (2026-03-02)

- Designation uniqueness updated to department scope:
  - same designation name allowed across different departments in same organization.
  - duplicate blocked only for same `(organization_id, department_id, name)`.
- Added migration:
  - `migrations/021_designation_uniqueness_by_department.sql`
- Controller duplicate conflict responses aligned with new constraint naming.

## Update Log (2026-03-09)

- Authentication login guard hardened:
  - login now explicitly verifies latest `organization_members.status`.
  - if membership is not `active`, login is denied (`403`).
- Billing + Stripe flow added:
  - `POST /billing/quote`
  - `POST /billing/checkout-session`
  - `POST /billing/checkout/confirm`
  - `GET /billing/payment-history`
  - `GET /billing/plan-comparison` (joins `feature_items` with `plan_features` for inclusion matrix)
  - checkout confirmation updates subscription plan and writes `payment_history` row.
  - payment success thank-you mail sent to billing email (SMTP required).
- Geo master APIs added for billing address:
  - `GET /geo/countries`
  - `GET /geo/states?country_id=<id>` (or `country_iso=<code>`)
- Coupon master module added:
  - table: `coupons` (`migrations/023_coupons_master.sql`)
  - public read APIs: `GET /coupons`, `GET /coupons/:id`
  - owner-only write APIs: `POST /coupons`, `PUT /coupons/:id`, `PATCH /coupons/:id`
  - billing quote + checkout now supports `coupon_code` with server-side validation and discount math.

## Update Log (2026-03-09, Docs Sync 2)

- Billing address module synced with current implementation:
  - `GET /billing/address` for default address
  - `GET /billing/addresses?limit=2` for recent address selection in UI
  - `PUT /billing/address` accepts `create_new` to insert a fresh address instead of updating default row
- Address persistence behavior updated:
  - duplicate address detection avoids repeated identical rows
  - if identical active address already exists, that row is reused and marked default
- Frontend alignment:
  - country/state are now manual text fields (not required to be geo IDs)
  - compare-plans opens in dialog and consumes `/billing/plan-comparison`



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

- Billing backend now records activity-log entries for checkout create/confirm, failed payment init, failed confirm, and billing-address save.
- `payment_history.invoice_number` generation is now based on the auto-increment `payment_id` and follows the `INV-TCX...` format.
- Stripe checkout session creation now sends richer metadata and customer details while still excluding direct third-party Stripe API docs from repo documentation.
- Payment failure persistence now stores exact structured `failure_reason JSONB`.

## Update Log (2026-03-13)

- Chat module added (`backend/src/chat/`):
  - `chatRoutes.js`, `chatController.js`, `chatModel.js`
  - `GET /chat/organizations` — returns all orgs the user is an active member of (JWT)
  - `GET /chat/threads?org_id=` — returns DM + group threads per org (JWT, multi-org support)
  - `GET /chat/contacts` — returns org members for starting DMs (JWT)
  - `GET /chat/threads/:id/messages` — paginated messages for DM or group thread (JWT)
  - `POST /chat/threads/:id/messages` — send message; saves to DB (JWT)
  - `POST /chat/threads/:id/read` — mark all messages in thread as read (JWT)
  - `PATCH /chat/messages/:id` — edit a DM message (JWT)
  - `DELETE /chat/messages/:id` — delete a DM message (JWT)
  - Thread ID format: `dm-{userId}` for DMs, `group-{groupId}` for groups
  - DM threads include: `email`, `mobile`, `designation`, `department`, `location`
  - Messages persisted in: `messages` table (DMs), `group_messages` + `group_message_recipients` (groups)
- Organization profile module added (`backend/src/routes/organizationProfileRoutes.js`):
  - `GET /organization/overview` — org overview (JWT)
  - `GET /organization/members` — org members list (JWT)
  - `GET /organization/members/:userId` — single member profile (JWT)
  - `GET /organization/departments` — org departments (JWT)
  - `GET /organization/designations` — org designations (JWT)
  - `GET /organization/locations` — org locations (JWT)

---

## Latest Updates (March 2026)

### New Features
- **AI Translation** — Translate messages to 28+ languages via Gemini/OpenAI (`POST /translate`)
- **AI Summarization** — Summarize text messages, PDFs, images, DOCX files (`POST /translate/summarize`). PDF text extraction (pdf-parse), image analysis (Gemini Vision), DOCX parsing.
- **Message Info Overlay** — View send/read/edit timestamps, reader device info, geo location via `message:info` socket event
- **Show More / Show Less** — Long messages (4+ lines) auto-collapse with toggle
- **Rich Text** — Bold, Italic, Underline preserved in HTML. Paste formatting preserved.
- **Owner Dashboard** — Socket Dashboard + System Health panels (`GET /auth/owner/v1/system/socket-stats`)
- **Dynamic Message Menu** — Menu items from DB (`message_menu_items`), per-org show/hide via `organization_message_menu_permissions`
- **Realtime Unread Count** — `thread:update` socket event with DB-accurate count
- **Green Tick (Read Receipt)** — `message:read_ack` updates both sidebar + chat window ticks
- **Geo Location** — Sender location in message metadata, reader location in read receipts
- **File Summarization** — PDF, Image, DOCX, text file content extraction for AI summarization

### New API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/translate` | JWT | Translate text |
| POST | `/translate/summarize` | JWT | Summarize text/file |
| GET | `/auth/owner/v1/system/socket-stats` | Owner | System monitoring |

### New Socket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `thread:update` | Server → Client | Unread count + read status changes |
| `message:info` | Client → Server (ACK) | Full message details from DB |
| `system:socket-stats:subscribe` | Client → Server | Owner: start live stats |
| `system:socket-stats` | Server → Client | Owner: live stats every 10s |

### New Migrations
| File | Description |
|------|-------------|
| `043_performance_indexes.sql` | Composite indexes for DM queries, unread count, user_devices |
| `044_fix_message_type_constraint.sql` | Allow image/video/audio/emoji/poll in message_type |

### Performance Improvements
- DM query: OR → UNION ALL (index-friendly)
- Unread count: N subqueries → 1 pre-aggregated JOIN
- Group message:info: N+1 loadUserGeo → 1 batch query
- Conversation loader: retry on failure + threadService cache fallback
- useChatSocket return memoized (prevents `thread:focus` spam)
- useStickyScroll: synchronous ref for scroll position check
