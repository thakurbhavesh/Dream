# Frontend Workflow and API Mapping

Last updated: 2026-03-09

## 1. App URLs

- Local frontend URL: `http://localhost:5173`
- Main app routes:
  - `/auth/login`
  - `/auth/register`
  - `/auth/reset-password`
  - `/app`
  - `/app/admin`
  - `/app/settings`
  - `/` (website pages)

## 2. API Base URL Resolution

Frontend API base is resolved in this order from `src/config/apiBaseUrl.js`:

1. `REACT_APP_API_URL`
2. `VITE_API_URL`
3. `VITE_SERVER_URL`
4. `VITE_BACKEND_URL`
5. `VITE_APP_API_URL`
6. fallback: `http://localhost:5000`

Socket URL resolution (`src/contexts/SocketContext.jsx`) checks:

- `VITE_SOCKET_URL`
- `VITE_API_URL`
- `VITE_SERVER_URL`
- `VITE_BACKEND_URL`
- `VITE_APP_API_URL`
- `REACT_APP_SOCKET_URL`
- `REACT_APP_API_URL`

## 3. Page to API Mapping

### Auth Pages

- `src/pages/auth/Login.jsx`
  - `POST /auth/login` (step-1: OTP send, step-2: OTP verify + login)
  - `GET /auth/csrf` (auto when CSRF cookie refresh required)
  - `GET /auth/me` (profile hydrate after login)

- `src/pages/auth/Register.jsx`
  - `POST /auth/create-account`
  - `POST /auth/verify-otp`

- `src/pages/auth/ResetPassword.jsx`
  - `POST /users/forgot-password`
  - `POST /users/forgot-verify`
  - `POST /auth/reset-password`

### Dashboard and Session

- `src/pages/dashboard/Settings.jsx`
  - `GET /auth/me`
  - `GET /auth/trusted-devices`
  - `POST /auth/trusted-devices/:deviceId/revoke`
  - `POST /auth/change-password`
  - `POST /auth/logout-all`
  - `POST /auth/logout` (single device logout with `device_id`)

- `src/layouts/dashboard/TopBar.jsx`
  - `POST /auth/logout` (logout using `client_device_id`)

### Website

- `src/website/components/Navbar.jsx`
  - `GET /api/desktop-apps/active`

## 4. Login Workflow (Actual App Flow)

Detailed secure auth version:
- `frontend/docs/a.md`
- Signup flow version:
  - `frontend/docs/Signupflow.md`
- Flow diagram version:
  - `frontend/docs/auth-flow-diagram.md`

1. User enters email/password on `/auth/login`.
2. Frontend sends `client_device_id`, `device_type`, `device_name` with login request.
3. If backend returns `otp_required=true`, UI moves to OTP step.
4. User submits OTP; frontend calls `POST /auth/login` again with `otp_code`.
5. Invalid OTP par attempts panel UI show hota hai (first open pe hidden).
6. On success, frontend stores token and calls `GET /auth/me`.
7. User redirected to `/app`.
8. Logout ke baad same `client_device_id` par relogin normally OTP-free rehta hai; OTP mainly new device par.
9. Device id generation/read ab shared utility (`src/utils/deviceId.js`) se hota hai, so login/logout/refresh me same stable `client_device_id` jata hai.

## 5. Password Reset Workflow

1. User enters email on `/auth/reset-password` -> `POST /users/forgot-password`.
2. User enters OTP -> `POST /users/forgot-verify` and receives `reset_token`.
3. User sets new password -> `POST /auth/reset-password`.
4. User redirected to `/auth/login`.

## 6. Settings Security Workflow

- Change password:
  - `POST /auth/change-password`
  - success ke baad frontend forced re-login karwata hai.

- Logout single session/device:
  - `POST /auth/logout` with `device_id` or `client_device_id`.

- Logout all devices:
  - `POST /auth/logout-all`
  - local session clear + redirect to login.

## 7. Local to Live API Switch

Use these steps:

1. Development values `frontend/.env.development` me rakho.
2. Production values `frontend/.env.production` me rakho.
3. Dev server restart karo (`npm run dev`), kyunki Vite env runtime pe reload nahi karta.

Development config (`.env.development`):

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Production config (`.env.production`):

```env
VITE_API_URL=https://server.officechatkarlo.com
VITE_SOCKET_URL=https://server.officechatkarlo.com
VITE_SERVER_URL=https://server.officechatkarlo.com
VITE_BACKEND_URL=https://server.officechatkarlo.com
VITE_APP_API_URL=https://server.officechatkarlo.com
REACT_APP_API_URL=https://server.officechatkarlo.com
REACT_APP_SOCKET_URL=https://server.officechatkarlo.com
```

## 7.1 Auto Refresh Timing (Important)

Frontend `/auth/refresh` kab call karta hai:
- app startup pe once (session warmup)
- har 60 seconds check cycle pe, agar access token near-expiry ho
- protected API pe `401` mile to retry flow me

Current token policy:
- access token: `15m`
- refresh token: `90d`
- refresh-reuse detection: backend `force_logout_all=true` return kare to frontend local auth clear karke login page pe redirect karta hai.

Iska clear matlab:
- refresh endpoint normally many times per day hit ho sakta hai.
- `90d` sirf max refresh-session validity window hai; refresh call ka interval nahi.

## 8. Frontend .env Update Done

Updated files:

- `frontend/.env.development` (localhost setup)
- `frontend/.env.production` (live server setup)
- `frontend/.env` (neutral/shared)

## 9. OTP UX Standard (All Auth Screens)

Shared behavior (`Login`, `Register`, `ResetPassword`):
- 6-box numeric-only OTP input.
- Paste support for full 6-digit code.
- 6 digits complete hone par auto-submit nahi hota; verify button manual click se trigger hota hai.
- resend cooldown timer API metadata (`retry_after_seconds`, `resend_available_in_seconds`) se sync hota hai.
- invalid OTP ya resend action par OTP input clear hota hai.
- `attempts_left=0` par OTP input aur verify button disable hote hain.

## 10. Frontend Performance Optimizations

- `src/pages/dashboard/Admin.jsx` me heavy tab panels lazy-load ho rahe hain (initial bundle/render faster).
- OTP resend timer logic shared hook (`useOtpResendCooldown`) me centralize hai, duplicate logic reduce hoti hai.

## Update Log (2026-03-02)

- Admin Global Members flow synced with current implementation:
  - default-permission modal uses `/global-access` create/patch/delete cycle.
  - selection UX updated with bulk visible-select and clear-all actions.

## Update Log (2026-03-09)

- Admin Billing tab flow updated to 3 steps:
  - Step 1: plan + users + currency + coupon apply
  - Step 2: billing address form
  - Step 3: checkout + payment confirmation
- Dynamic billing APIs mapped:
  - `/billing/quote`, `/billing/checkout-session`, `/billing/checkout/confirm`
  - `/billing/payment-history`, `/billing/plan-comparison`
  - `/billing/address`, `/billing/addresses?limit=2`
  - `/geo/currencies` (optional currency source)
- Billing address form supports prefill (company/name/email) + editable fields.

## Update Log (2026-03-09, Docs Sync 2)

- Billing step-2 address UX updated:
  - recent 2 addresses selectable
  - add-new address mode with backend `create_new`
  - manual country/state entry (not forced dynamic dropdown)
- Compare plans rendering updated:
  - now shown in responsive dialog/modal.



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

- Billing workflow now finishes on `/app/billing/thank-you?session_id=...` before redirecting back to admin billing.
- Payment success should trigger:
  - checkout confirm
  - payment history update
  - confetti/notification
  - admin redirect
- Shared frontend helper `buildSubscriptionView(...)` should be reused anywhere subscription chips, expiry, or license usage are rendered.
