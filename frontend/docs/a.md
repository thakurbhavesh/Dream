# Frontend Auth Login Workflow

Last updated: 2026-03-09

Ye document batata hai frontend login/auth ka actual secure flow kaise chal raha hai.

## 1. Login Start (`/auth/login`)

File: `src/pages/auth/Login.jsx`

1. User email + password enter karta hai.
2. Frontend `client_device_id` create/read karta hai (`chatx.deviceId`).
3. `POST /auth/login` call hoti hai with device metadata.

Possible outcomes:
- `otp_required=true` -> OTP step open hota hai.
- direct success -> session ready.

## 2. OTP Step (if required)

1. User 6-box numeric OTP input me code enter karta hai (paste + auto-focus support).
2. Same login API dubara call hoti hai with `otp_code`.
3. Backend success par auth cookies set karta hai:
   - `access_token` (`HttpOnly`)
   - `refresh_token` (`HttpOnly`)
   - `csrf_token` (readable cookie)

OTP UX + controls:
- 6-digit complete hone par auto-submit nahi hota; user manually `VERIFY & LOGIN` click karta hai.
- Resend OTP button cooldown ke sath chalti hai (`resend_available_in_seconds`).
- Wrong OTP par attempts panel sirf error ke baad dikhaya jata hai.
- Wrong OTP ya resend action par OTP input clear ho jata hai.
- `attempts_left=0` par OTP input aur verify button disable ho jate hain.
- Same device (`chatx.deviceId`/`client_device_id`) par logout ke baad next login me OTP repeat nahi hota.

## 3. Profile Hydration

Login success ke baad frontend:
1. `GET /auth/me` call karta hai (`credentials: include`).
2. User/org/role profile hydrate karta hai.
3. `authStore.login(...)` se local UI identity state save hoti hai.
4. Redirect `/app`.

## 4. Protected API Calls

Files:
- `src/utils/fetchJson.js`
- `src/utils/authApi.js`
- `src/utils/csrf.js`

Behavior:
- sab requests `credentials: include` ke saath jati hain.
- unsafe methods (`POST/PUT/PATCH/DELETE`) me `X-CSRF-Token` header auto attach hota hai.
- bearer token optional fallback hai; cookie-auth primary mode hai.

## 5. Auto Refresh Flow

Files:
- `src/main.jsx`
- `src/utils/auth.js`

Flow:
1. App mount pe `ensureFreshSession()` run hota hai.
2. Har 60s interval pe near-expiry check hota hai.
3. Need ho to `POST /auth/refresh` call hoti hai.
4. Backend naya cookie pair rotate karta hai.
5. Agar backend refresh-token reuse detect kare to `force_logout_all` response deta hai and frontend auto logout karta hai.

Important:
- Refresh 90 din baad nahi hota.
- Refresh demand pe hota hai; `90d` max refresh-session window hai.

## 6. Logout Flow

File: `src/layouts/dashboard/TopBar.jsx`

1. `POST /auth/logout` call with device context.
2. Backend session revoke + auth cookies clear karta hai.
3. Frontend local auth/profile state clear karta hai.
4. Redirect `/auth/login`.

`logout-all` settings page se available hai aur sab sessions revoke karta hai.

## 7. Trusted Device Controls

Settings activity tab me frontend:
- `GET /auth/trusted-devices` se trusted list fetch karta hai.
- `POST /auth/trusted-devices/:deviceId/revoke` se selected trusted device revoke karta hai.

Revoke ke baad:
- device trusted badge remove hota hai.
- us device ki active sessions backend revoke karta hai.

## 8. Security Summary

- HttpOnly cookies for JWT tokens.
- CSRF token double-submit pattern.
- Device-aware sessions.
- Short access token (`15m`) + long refresh window (`90d`) with rotation.
- Role/org guarded APIs through middleware.

## Update Log (2026-02-27)

- OTP input standardized to 6-box numeric entry.
- OTP attempts widget now appears only after first invalid OTP response.
- Added trusted-device revoke workflow notes.

## Update Log (2026-03-09)

- Login flow note added for backend guard: if `organization_members.status` is not `active`, login is denied.
- Existing OTP/trusted-device flow remains unchanged.

## Update Log (2026-03-09, Docs Sync 2)

- Auth/login flow remains unchanged by billing module updates.
- Documentation synchronized date and references with latest admin billing flow docs.



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

- Billing/admin UI helpers were standardized for dates, site-details, notifications, and subscription rendering.
- Payment history and subscription chips should reuse shared helpers instead of passing static display values.
