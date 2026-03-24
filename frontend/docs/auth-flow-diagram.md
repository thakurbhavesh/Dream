# Frontend Auth Flow Diagram

Last updated: 2026-03-09

This document provides line-by-line auth flow for:
- login
- refresh
- rotation
- logout

## 1) Login Flow

```text
User (/auth/login page)
  -> POST /auth/login (email, password, client_device_id, device info)

Backend (authController.login)
  -> validate user + password
  -> if untrusted device and no otp_code:
       returns otp_required=true
  -> else (trusted/otp verified):
       access_token = signAccessToken(...)
       refresh_token = generateRefreshToken(...)
       save refresh_token_hash in user_sessions
       setAuthCookies():
         - access_token (HttpOnly cookie)
         - refresh_token (HttpOnly cookie)
         - csrf_token (readable cookie)
       response success (+ user info)

Frontend
  -> GET /auth/me (credentials: include)
  -> authStore.login(...) stores UI identity
  -> redirect /app
```

## 2) Auto Refresh Flow

Triggers:
- app startup (`main.jsx -> ensureFreshSession`)
- periodic check every 60s (`startAutoRefresh`)
- 401 retry path (`fetchWithAuth`)

```text
Frontend (authStore.refreshSession)
  -> POST /auth/refresh
     body: refresh_token (optional fallback), client_device_id
     headers: X-CSRF-Token
     credentials: include

Backend (authController.refresh)
  -> reads refresh_token (body OR refresh_token cookie)
  -> validate session (active + not expired)
  -> if revoked refresh reused (outside grace):
       revoke all active sessions + mark all devices logged_out
       return 401 with force_logout_all
  -> revoke old session row
  -> create new session row with new refresh_token_hash
  -> issue new access_token + new_refresh_token
  -> setAuthCookies() again (rotated cookies)
  -> response success
```

## 3) Rotation Meaning

```text
Old refresh token/session
  -> invalidated (revoked)

New refresh token/session
  -> created and set in cookie

Access token
  -> freshly signed again with latest expiry window
```

## 4) Logout (Single Session/Device)

```text
Frontend (TopBar/Settings)
  -> POST /auth/logout (device_id/client_device_id or refresh_token)
     credentials: include + CSRF header

Backend (authController.logout)
  -> identify target session/device
  -> revoke active sessions for that device/token
  -> mark device logged_out (when no active sessions left)
  -> keep trusted-device identity for same client_device_id
  -> clearAuthCookies() (access/refresh/csrf)
  -> response: Logged out

Frontend
  -> authStore.logout() clears local identity state
  -> redirect /auth/login

Next login note:
  -> same client_device_id can login without OTP
  -> OTP challenge should appear for new/unrecognized device
```

## 5) Logout-All

```text
Frontend
  -> POST /auth/logout-all (credentials + CSRF)

Backend (authController.logoutAll)
  -> revoke all active sessions for user
  -> mark all devices logged_out
  -> clearAuthCookies()
  -> response: Logged out from all devices

Frontend
  -> local logout + redirect login
```

## 6) CSRF Safety

```text
Unsafe methods (POST/PUT/PATCH/DELETE with auth cookies):
  must send header X-CSRF-Token == csrf_token cookie

If 403 due to CSRF mismatch:
  frontend auto calls GET /auth/csrf
  then retries request
```

## 7) OTP Resend + Lock Controls

```text
Backend OTP issue endpoints (login/create-account/resend/forgot-password)
  -> check resend cooldown window
  -> if too early: 429 + retry_after_seconds
  -> check temporary lock window after max failed attempts
  -> if locked: 429 + locked_for_seconds

Frontend OTP pages
  -> show resend timer
  -> disable resend button till cooldown ends
  -> use retry_after_seconds from API when returned
  -> do not auto-submit on 6 digits (manual verify button click)
  -> clear OTP input on wrong OTP and on resend
  -> disable OTP input + verify button when attempts_left = 0
```

## 8) Trusted Device Revoke Flow

```text
Frontend (Settings -> Activity tab)
  -> GET /auth/trusted-devices
  -> user clicks revoke on device
  -> POST /auth/trusted-devices/:deviceId/revoke

Backend
  -> set user_devices.is_trusted = false
  -> revoke active sessions mapped to that device
  -> response success
```

## Update Log (2026-03-09)

- Added login guard assumption: membership must be `active` in `organization_members`.

## Update Log (2026-03-09, Docs Sync 2)

- Auth diagram verified unchanged after billing/address/coupon module changes.
- Linked workflow separation note: billing flow documented in `frontend/docs/workflow.md`.



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

- Auth remains unchanged at the core, but admin dashboard summary cards and billing surfaces now consume shared subscription formatting helpers after login.
- Organization current-plan responses should be treated as the canonical input for `buildSubscriptionView(...)`.
