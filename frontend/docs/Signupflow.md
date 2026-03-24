# Frontend Signup Flow

Last updated: 2026-03-09

Ye document explain karta hai ki frontend me signup (create account) flow kaise kaam karta hai.

## 1. Signup Entry

Route:
- `/auth/register`

Primary file:
- `src/pages/auth/Register.jsx`

User form fields:
- `company_name`
- `owner_name`
- `email` (business email expected)
- `phone`
- `password`

## 2. Account Create Request

Frontend request:
- `POST /auth/create-account`

Payload me above fields jate hain.

Backend successful response par:
- user + organization create ho jata hai
- verification OTP issue hota hai
- response me OTP metadata mil sakta hai (for flow state)

Frontend behavior:
- UI OTP verification step pe switch hoti hai.

## 3. OTP Verification Step

Frontend request:
- `POST /auth/verify-otp`

Payload:
- `email`
- `otp_code`

UI behavior:
- 6-box numeric OTP component use hota hai.
- paste/autofocus supported hai.
- 6 digits complete hone par auto-submit nahi hota; user manual verify button click karta hai.
- OTP attempts status first load pe hidden rehta hai; sirf invalid OTP response ke baad show hota hai.
- Wrong OTP ya resend par OTP input auto-clear hota hai.
- `attempts_left=0` par OTP input + verify button disable ho jate hain.

Success par:
- account verified mark hota hai.
- user ko login screen ya direct login path ki taraf bheja jata hai (project flow ke hisab se).

## 4. Resend OTP (if needed)

Frontend request:
- `POST /auth/resend-otp`

Use case:
- OTP expire ho gaya
- OTP receive nahi hua
- cooldown complete hone ke baad hi resend active hota hai (`retry_after_seconds` / `resend_available_in_seconds` driven)

## 5. Validation and Error UX

Frontend level:
- required field checks
- email format check
- password strength/min length check

Backend business errors (common):
- email already exists
- non-business/free email blocked
- invalid/expired OTP
- OTP attempts exhausted

UI should show:
- exact API message in toast/alert
- OTP step me retry guidance

## 6. Security Notes

- Signup public route hai (JWT required nahi).
- OTP verification ke bina account fully trusted nahi hota.
- Login ke baad auth/session cookie flow apply hota hai (`HttpOnly` + CSRF protected requests).

## 7. Recommended QA Checklist

1. Fresh signup success + OTP verify success.
2. Wrong OTP attempts and error messages.
3. Expired OTP + resend + verify.
4. Existing email signup attempt.
5. Free/public email domain rejection.
6. Signup ke baad login flow integration check.

## Update Log (2026-02-27)

- Shared numeric OTP UX added (6-box input, paste).
- OTP verify is manual click based (no auto-submit).
- OTP attempts panel visibility rule updated (show only after invalid attempt).
- Wrong OTP/resend on OTP step now clears input.
- Resend cooldown synced from backend timer fields.

## Update Log (2026-03-09)

- Signup flow unchanged functionally; doc synced to latest shared OTP behavior and current release date.

## Update Log (2026-03-09, Docs Sync 2)

- Cross-reference added for billing docs:
  - signup/auth flow unchanged
  - billing and coupon updates are documented in `frontend/docs/workflow.md`



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

- Default subscription provisioning remains part of signup, but admin subscription rendering is now normalized via `frontend/src/utils/subscription.js`.
- Billing-related docs should no longer assume timestamp-based invoice IDs.
