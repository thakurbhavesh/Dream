# Mail Templates Map

Last updated: 2026-03-09

All email templates are centralized under `src/templates/mail/`.

## Auth
- `auth/verificationOtpTemplate.js`
- `auth/forgotPasswordOtpTemplate.js`
- `auth/passwordResetSuccessTemplate.js`
- `auth/welcomeTemplate.js`

## Organization Users
- `orgUser/accountCreatedTemplate.js`
- `orgUser/passwordResetTemplate.js`

## Contact Us
- `contactUs/adminNotificationTemplate.js`
- `contactUs/customerAcknowledgementTemplate.js`

Shared export entry:
- `src/templates/mail/index.js`
- dynamic branding source: `src/utils/mailBranding.js` (reads `/site-details` data with env fallback)

## Session and Mail Boundary

Auth mail templates OTP/password-reset events ke liye hain.

Token refresh behavior:
- `/auth/refresh` flow me koi email template trigger nahi hota.
- session persistence/revocation DB + token rotation layer handle karti hai.

Is separation se mail pipeline light rehti hai aur high-frequency refresh calls mail system ko impact nahi karte.

## Update Log (2026-02-26)

- Templates split by domain (`auth`, `orgUser`, `contactUs`) for easier maintenance.
- Controllers now consume templates from `src/templates/mail/index.js`.
- Organization restrictions module added without new mail templates.
- Added password reset success template for post-reset security confirmation emails.

## Update Log (2026-03-09)

- Added billing mail template group: `billing/paymentSuccessTemplate.js`.
- Billing checkout confirmation now sends payment-success/thank-you mail to billing email.

## Update Log (2026-03-09, Docs Sync 2)

- Address selection (`recent addresses` / `create_new`) does not introduce additional mail templates.
- Coupon apply flow is reflected in billing checkout metadata; existing payment-success template remains valid.




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

- Billing success mail was cleaned up to avoid repeated duplicate data.
- Template layout is now closer to the Payment History view modal structure with invoice/subscription, billing parties, and amount summary sections.
- Current invoice values in mail are sourced from the normalized payment-history invoice format.
