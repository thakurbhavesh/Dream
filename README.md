# TeamChatX

Last updated: 2026-03-13

#collaborator
- Hardik

Repository structure:
- `backend/` Node.js + Express + PostgreSQL API
- `frontend/` React + Vite client

Backend API and schema docs:
- `backend/README.md`
- `backend/docs/api.md`
- `backend/docs/documentation.md`
- `backend/docs/database.md`

Frontend docs:
- `frontend/README.md`
- `frontend/docs/workflow.md`

Recent docs update:
- `site-details` module (`/site-details`) with public GET and owner-only write access
- `site_details` schema no longer uses `organization_id`
- migration `015_site_details_remove_organization_id_and_truncate.sql`
- `product-features` module (`/product-features`, `/product-features/categories`) with owner-only write access
- migration `016_product_features.sql` (feature tabs + items seed)
- `contact-us` module (`/contact-us`) with public submit and role-based read access
- migration `017_contact_us.sql`
- `organization-restrictions` module (`/organization-restrictions/ip`, `/organization-restrictions/platform`)
- migration `018_organization_access_restrictions.sql`
- contact mail flow:
  - admin notification -> `CONTACT_US_NOTIFY_TO` (recommended: `support@teamchatx.com`)
  - customer thank-you mail -> submitted `email_address`
  - mail dispatch async/background for faster `POST /contact-us`
- all backend mail templates moved to `backend/src/templates/mail/*`
- forgot-password now uses 2-step OTP verify + token reset flow with live attempt counters
- duplicate group names are blocked per organization (case-insensitive)
- auth routes updated:
  - `POST /auth/change-password` (JWT)
  - `POST /auth/logout` (JWT)
  - `POST /auth/logout-all` (JWT)
- frontend environment split by mode:
  - `frontend/.env.development` -> localhost API
  - `frontend/.env.production` -> live server API
- auth/session hardening updates:
  - HttpOnly cookie auth + CSRF token flow (`GET /auth/csrf`)
  - refresh-token rotation with reuse detection (`force_logout_all`)
  - OTP resend cooldown + lock window controls
  - same trusted device relogin stays OTP-free (OTP mainly for new/unrecognized devices)
  - trusted device management endpoints (`GET /auth/trusted-devices`, `POST /auth/trusted-devices/:deviceId/revoke`)
  - `/auth/me` auth timeline in response (`auth_timeline`)
  - new auth E2E checklists in:
    - `backend/docs/auth-e2e-checklist.md`
    - `frontend/docs/auth-e2e-checklist.md`

## Update Log (2026-02-27)

- Auth docs aligned with latest secure session flow:
  - HttpOnly cookies + CSRF endpoint
  - trusted-device APIs
  - refresh reuse detection and forced logout behavior
  - OTP cooldown + temporary lock controls
- Frontend auth docs updated for:
  - 6-box numeric OTP UX
  - attempts panel visible only after invalid OTP
  - resend cooldown timer sync from backend

## Update Log (2026-02-25)

- Mail templates centralized at `backend/src/templates/mail/`.
- Contact Us: admin notify (`CONTACT_US_NOTIFY_TO`) + customer acknowledgement mail.
- `POST /contact-us` fast response via async/background mail dispatch.
- Added organization restrictions APIs with activity logging for create/update/patch actions.

## Update Log (2026-03-02)

- All project markdown docs refreshed with current `Last updated` date.
- Backend designation uniqueness behavior documented as org+department scoped.
- Migration docs updated with `021_designation_uniqueness_by_department.sql`.
- Frontend global-member default-permission modal workflow notes refreshed.

## Update Log (2026-03-09)

- Admin UI updates:
  - Department list actions now show inline `Edit` and `Delete` buttons (3-dot menu removed).
  - Designation list actions now show inline `Edit` and `Delete` buttons (3-dot menu removed).
  - Designation add/edit flow reordered for better UX:
    - select `Department` first, then enter `Designation`.
    - designation input now stays disabled until a department is selected.
  - Department/Designation grid alignment improved with centered action cells and responsive row/header sizing.
  - Billing tab upgraded to dynamic API-driven flow:
    - plans loaded from `/plans`
    - compare-plans and feature matrix powered by `/plan-features/plan/:planId/summary`
    - light/dark adaptive UI with responsive cards, table and plan summary blocks.
  - Stripe checkout integrated with backend billing APIs and `.env` driven secrets/rates.
  - Billing upgraded to 3-step wizard and feature-items based plan comparison.
- User status display now prefers `organization_members.status` as the primary status source in admin user tables.
- Login hardening:
  - if latest `organization_members.status` is not `active`, login is blocked with membership-inactive message.

## Update Log (2026-03-09, Docs Sync 2)

- Billing documentation aligned with implemented flow:
  - Step 1: plan/users/currency + manual coupon apply
  - Step 2: billing address (manual country/state text input)
  - Step 3: Stripe checkout and confirm
- Address-book behavior documented:
  - same organization can select last 2 saved addresses
  - user can choose `Add New Address`
  - duplicate address rows are prevented in backend save flow
- API docs aligned with latest billing routes:
  - `GET /billing/address`
  - `GET /billing/addresses?limit=2`
  - `PUT /billing/address` (`create_new` supported)


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

- Billing and subscription flows were refreshed across frontend and backend.
- Invoice numbers now use `payment_history.payment_id` and render as `INV-TCX...` instead of timestamp-based values.
- Admin billing now relies on shared frontend helpers for date, site-details, notification, and subscription view normalization.
- Payment success flow now routes through `BillingThankYou` before redirecting back to admin billing.
- Billing activity events are now written into `activity_log` for checkout create, confirm, failures, and billing-address save.

## Update Log (2026-03-13)

- Chat module added (`/chat` API + frontend sync):
  - `GET /chat/organizations` — multi-org membership list
  - `GET /chat/threads?org_id=` — DM + group thread list per org
  - `GET /chat/contacts` — org contacts for DM
  - `GET /chat/threads/:id/messages` — paginated message fetch
  - `POST /chat/threads/:id/messages` — send message (saves to DB)
  - `POST /chat/threads/:id/read` — mark thread read
  - `PATCH /chat/messages/:id` — edit DM message
  - `DELETE /chat/messages/:id` — delete DM message
- Organization profile module added (`/organization` API):
  - `GET /organization/overview|members|members/:userId|departments|designations|locations`
- Frontend chat list fully dynamic:
  - `useChatSync` hook fetches all orgs + threads from backend on mount
  - Real DM threads include designation, department, location from org member data
  - Multi-org tab support: org tabs shown when user belongs to multiple orgs
  - Myself thread starts empty (no mock messages); shows real user email as preview
  - Tick icon removed from threads with no messages
  - Email shown as preview for threads with no messages
  - "No Group found" shown when group search returns empty results

---

## Update Log (2026-04-14)

Shipped in a single day across web, mobile and backend:

- **Web Push (VAPID)**: service-worker background notifications for messages,
  incoming calls, missed calls, meeting invites and screen-share requests.
  Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in backend env
  and run migration `069_push_subscriptions.sql`.
- **External guest meetings**: email up to 2 external guests per meeting — they
  join via a secure `/guest/:token` link + 6-digit code with zero-signup guest
  JWT. Migration `070_meeting_guests.sql`.
- **Full-page meeting hub** at `/app/meeting` replacing the modal, with
  Instant / Schedule / Join tabs and a participant picker.
- **Meeting history**: past tab alongside upcoming, with duration and host.
- **Call history**: per-contact dialog from the chat header three-dot menu,
  All / Missed / Audio / Video filters. Migration `071_call_logs.sql` backs it.
- **Missed calls in chat**: declined / unanswered / offline calls post a
  `📞` entry into the DM for both sides.
- **Pinned chats**: up to 20 per user, sorted on top, real-time sync.
  Migration `072_user_thread_pins.sql`.
- **Call reliability**: 45s caller ring timeout, peer mute/camera badges,
  persistent remote audio across minimize, mobile↔web WebRTC interop fix,
  socket auto-reconnect on visibility/focus/online with fresh auth token.
- **DB**: migrations 069 → 073 added. `073_seed_today_features.sql` seeds 14
  user-facing items into `feature_items`. A paste-ready combined file for
  Neon lives at `backend/migrations/run_on_neon_today.sql`.

New routes:
- `GET /push/vapid-public-key`, `POST /push/subscribe`, `POST /push/unsubscribe`
- `GET /calls?peer_id=`
- `GET /meetings/past`, `GET /meetings/guest/:token`, `POST /meetings/guest/:token/verify`
- `POST /meetings/` now accepts `guest_emails: string[]` (max 2)

New socket events:
- `thread:pin` (client) · `thread:pin_sync`, `thread:pin_update` (server)
- Signal subtype `call:signal { type: 'media-state', muted?, videoOff? }`
- Guest JWTs carry `guest: true` and are recognised by `authenticateSocket`;
  guest sockets skip presence/sync and only run meeting handlers.
