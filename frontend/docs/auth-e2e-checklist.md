# Frontend Auth E2E Checklist

Last updated: 2026-03-09

## Login + OTP

- Open `/auth/login`, submit valid email/password (untrusted device).
- Confirm OTP step opens and resend button starts cooldown timer.
- OTP input should accept numeric digits only.
- Enter invalid OTP once:
  - attempts panel should appear
  - attempts-left metadata should update from API
- Enter 6 valid digits, then click verify button:
  - login should complete
  - redirect to `/app`.
- If attempts reach `0`:
  - OTP input and verify button should remain disabled.
- Wrong OTP or resend action should clear OTP input boxes.
- After logout, login again from same device:
  - OTP should not be asked again.

## OTP Resend

- During cooldown, resend button remains disabled.
- After cooldown, resend works and cooldown restarts.
- If backend returns `retry_after_seconds`, UI timer syncs to that value.

## Refresh Security

- Keep app idle until access token nears expiry, confirm silent refresh works.
- Reuse/revoked refresh token simulation should trigger forced logout:
  - local auth cleared
  - redirect to login.

## Trusted Device Management

- Open settings activity tab.
- Trusted device badge appears for trusted sessions.
- Click `Revoke trust` on a trusted device:
  - badge removed
  - device session revoked from list.

## CSRF Retry

- Force CSRF mismatch on an unsafe request.
- Frontend should call `GET /auth/csrf` automatically and retry request once.

## Activity Timeline

- In settings activity tab, verify auth timeline cards render:
  - login
  - refresh
  - logout / security events.

## Update Log (2026-03-09)

- Added E2E assertion: user with non-active organization membership should be blocked at login.

## Update Log (2026-03-09, Docs Sync 2)

- Auth checklist reaffirmed as unchanged by billing/coupon UI updates.
- Added doc-sync note to keep auth testing scope separate from billing testing.


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

- Extend manual E2E checks to cover post-login billing confirmation:
  - complete checkout
  - land on `BillingThankYou`
  - see confetti/notification
  - confirm redirect to admin billing
  - verify payment history row and `INV-TCX...` invoice format
