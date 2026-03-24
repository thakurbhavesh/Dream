# Payment Flow (Stripe + PayPal) - API, Data, and Money Movement

Last updated: 2026-03-19

This document explains exactly:
- which API is called from frontend
- what data goes to backend and Stripe
- how money is charged
- where payment success/failure is stored

## 1) High-Level Answer (Short)

1. Frontend never charges card directly from your server.
2. Backend creates a Stripe Checkout Session using `STRIPE_SECRET_KEY` from `.env`.
3. User pays on Stripe-hosted page.
4. Stripe captures amount and returns a `session_id`.
5. App calls confirm API and backend verifies payment from Stripe API.
6. Backend updates `subscriptions` and writes `payment_history`.

## 2) Components Used

- Frontend billing UI:
  - `frontend/src/components/Admin/tabs/Billing.jsx`
  - `frontend/src/components/Admin/sections/PaymentHistory.jsx`
- Backend routes:
  - `backend/src/routes/billingRoutes.js`
- Backend logic:
  - `backend/src/controllers/billingController.js`
  - `backend/src/models/billingModel.js`
  - `backend/src/models/couponModel.js`

## 3) APIs Used in Billing Flow

### 3.1 Quote API

- `POST /billing/quote`

Purpose: calculate subtotal, discount, grand total before payment.

Typical request:

```json
{
  "plan_id": 4,
  "user_count": 4,
  "cycle": "month",
  "currency": "INR",
  "country": "India",
  "coupon_code": "WELCOME30"
}
```

Typical response fields:

```json
{
  "per_user_monthly": 1100,
  "per_user_cycle": 1100,
  "subtotal": 4400,
  "discount_amount": 1320,
  "grand_total": 3080,
  "currency": "INR"
}
```

### 3.2 Create Checkout Session API

- `POST /billing/checkout-session`

Purpose: create Stripe session and get redirect URL.

Important input includes:
- plan and pricing selection
- billing type (`upgrade` or `renewal`)
- address snapshot
- coupon details (if applied)

Typical response:

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

Frontend then redirects browser to `checkout_url`.

### 3.3 Confirm API

- `POST /billing/checkout/confirm`

Called after return from Stripe success URL:

- `/app/admin?billing_checkout=success&session_id={CHECKOUT_SESSION_ID}`

Backend verifies `session_id` with Stripe and then updates DB.

## 4) Stripe API Calls Actually Happening

Backend Stripe client is initialized with:
- `STRIPE_SECRET_KEY` (primary)
- `BILLING_STRIPE_SECRET_KEY` (fallback)

If missing, checkout fails with: `Stripe is not configured. Missing STRIPE_SECRET_KEY`.

Common Stripe actions in flow:
1. Create Checkout Session (server-side)
2. Retrieve Checkout Session in confirm step
3. Read payment status/intent id and paid amount

## 5) Data Sent to Stripe

Only billing/order metadata and amount context are sent.

Examples (metadata):
- `organization_id`
- `user_id`
- `plan_id`
- `user_count`
- `cycle`
- `period_months`
- `currency`
- `country`
- `subtotal`
- `discount_amount`
- `coupon_code`
- billing name/email/company/address

Card number/CVV handling:
- Card details are entered on Stripe page.
- Your backend does not store raw card number/CVV.

## 6) Money Movement (Paisa Kaise Jata Hai)

1. App computes amount using plan + user count + cycle + coupon.
2. Backend sends final payable amount to Stripe session.
3. User pays on Stripe checkout page.
4. Stripe captures funds into your Stripe account balance.
5. Stripe settles/payout to linked bank account as per Stripe payout schedule.

Notes:
- Actual bank settlement timing depends on Stripe account settings and country.
- In test mode, no real money moves.

## 7) Database Writes After Payment

### On successful confirm

- `subscriptions`:
  - create new row or update active subscription
  - plan, user limits, storage, start/end dates updated

- `payment_history`:
  - insert payment row with status `success`
  - includes invoice number, transaction id, amount, currency, coupon, discount, billing snapshot

### On failure

- `payment_history` inserts/updates failure row with status `failed` where applicable
- UI shows retry (`Re-Pay`) in Payment History

## 8) Payment Status Source of Truth

Source of truth is Stripe session verification during confirm API.

Do not mark payment success only from frontend query params.
Always verify `session_id` server-side with Stripe API first.

## 9) Coupon Behavior

Coupon is validated in backend against coupon table:
- active status
- date range
- min order
- usage limits

On successful payment:
- coupon usage count is incremented.

## 10) Subscription Upgrade/Renewal Rules

Billing type supported:
- `upgrade`
- `renewal`

After success:
- limits and validity update immediately from backend transaction
- payment row saved in same business flow

## 11) Required Env Vars

- `STRIPE_SECRET_KEY`
- `BILLING_STRIPE_SECRET_KEY` (optional fallback)
- `FRONTEND_ORIGIN` or `CORS_ORIGIN`
- `BILLING_CURRENCY_DEFAULT`
- `BILLING_RATE_API_URL`
- `BILLING_RATE_TIMEOUT_MS`
- `BILLING_USD_TO_INR` (fallback conversion helper)

## 12) End-to-End Sequence

1. Step 1: Plan -> `POST /billing/quote`
2. Step 2: Address -> save/select billing address
3. Step 3: Checkout -> `POST /billing/checkout-session`
4. Redirect to Stripe hosted checkout
5. Stripe success redirects back to `/app/admin?billing_checkout=success&session_id=...`
6. Frontend calls `POST /billing/checkout/confirm`
7. Backend verifies Stripe session
8. Backend updates `subscriptions`
9. Backend writes `payment_history`
10. Success UI + mail + Payment History visible

## 13) Troubleshooting Quick Checks

### Error: Missing STRIPE_SECRET_KEY
- check `.env` in backend
- restart backend after env change

### Payment success screen but DB not updated
- check confirm API call in network tab
- verify backend logs for Stripe/session verification error
- ensure DB migration is up-to-date for payment columns

### Amount mismatch
- verify plan `price` is per-user
- verify cycle multiplier (monthly/yearly)
- verify coupon percent/amount and cap rules
- verify currency conversion source and fallback rates

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

- Payment flow now confirms checkout through the app thank-you screen and then redirects to admin billing.
- Success handling includes payment-history persistence, invoice creation using `INV-TCX...`, success mail dispatch, activity-log creation, notification triggering, and frontend celebration.
- Failed flows persist exact `failure_reason JSONB` and emit billing activity-log entries.

---

## PayPal Payment Flow (Full)

### Overview

TeamChatX supports **dual payment gateways**: Stripe and PayPal. The gateway is selected at checkout time via the `gateway` parameter. Both follow the same billing APIs but diverge at the provider level.

### PayPal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│                                                              │
│  1. User selects plan + address                              │
│  2. POST /billing/checkout-session { gateway: "paypal" }     │
│  3. Receives PayPal approve_url                              │
│  4. Redirects user to PayPal hosted page                     │
│  5. User pays on PayPal → redirected back                    │
│  6. POST /billing/checkout/confirm { session_id: order_id }  │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ BACKEND (billingController.js)                                │
│                                                               │
│  Checkout Session:                                            │
│  ├─ getPaypalAccessToken() → OAuth2 client_credentials        │
│  ├─ createPaypalOrder() → POST /v2/checkout/orders            │
│  │  ├─ intent: CAPTURE                                        │
│  │  ├─ amount + currency                                      │
│  │  ├─ payer info (name, email, address)                      │
│  │  ├─ return_url + cancel_url                                │
│  │  └─ shipping_preference: NO_SHIPPING                       │
│  └─ Returns approve_url to frontend                           │
│                                                               │
│  Confirm:                                                     │
│  ├─ getPaypalAccessToken()                                    │
│  ├─ getPaypalOrder() → GET /v2/checkout/orders/:id            │
│  ├─ capturePaypalOrder() → POST /v2/checkout/orders/:id/capture│
│  ├─ Verify payment status = COMPLETED                         │
│  ├─ Update subscriptions table                                │
│  └─ Write payment_history                                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ PAYPAL API                                                    │
│                                                               │
│  Sandbox: https://api-m.sandbox.paypal.com                    │
│  Live:    https://api-m.paypal.com                            │
│                                                               │
│  Endpoints used:                                              │
│  ├─ POST /v1/oauth2/token → Access token (client_credentials) │
│  ├─ POST /v2/checkout/orders → Create order                   │
│  ├─ GET  /v2/checkout/orders/:id → Get order status           │
│  └─ POST /v2/checkout/orders/:id/capture → Capture payment    │
└──────────────────────────────────────────────────────────────┘
```

### PayPal Step-by-Step Flow

#### Step 1: Quote (Same as Stripe)
```
POST /billing/quote
{
  "plan_id": 4,
  "user_count": 4,
  "cycle": "month",
  "currency": "USD",
  "country": "US"
}
→ Returns: subtotal, discount, grand_total
```

#### Step 2: Create Checkout Session (PayPal)
```
POST /billing/checkout-session
{
  "plan_id": 4,
  "user_count": 4,
  "cycle": "month",
  "currency": "USD",
  "country": "US",
  "billing_type": "upgrade",
  "address": { "fullName": "John Doe", "addressLine1": "123 Main St", ... },
  "gateway": "paypal"     ← This triggers PayPal flow
}
```

**Backend internally:**
1. Validates plan, calculates quote
2. `getPaypalAccessToken()` → OAuth2 token from PayPal
3. `createPaypalOrder()` → Creates PayPal order via `/v2/checkout/orders`
4. Saves checkout metadata to `billing_checkout_sessions`
5. Returns PayPal approve URL

**Response:**
```json
{
  "checkout_url": "https://www.sandbox.paypal.com/checkoutnow?token=5GR...",
  "session_id": "5GR12345AB678901C",
  "gateway": "paypal"
}
```

#### Step 3: User Pays on PayPal
- Frontend redirects to `checkout_url`
- User logs into PayPal / pays with card/balance
- PayPal redirects back to: `/app/admin?billing_checkout=success&session_id={ORDER_ID}&gateway=paypal`

#### Step 4: Confirm Payment
```
POST /billing/checkout/confirm
{
  "session_id": "5GR12345AB678901C"
}
```

**Backend internally:**
1. Detects gateway = `paypal` from `billing_checkout_sessions`
2. `getPaypalAccessToken()` → fresh OAuth2 token
3. `getPaypalOrder(orderId)` → GET order status
4. If status != COMPLETED → `capturePaypalOrder(orderId)` → captures payment
5. Verifies `status === 'COMPLETED'`
6. Updates `subscriptions` table (plan, limits, dates)
7. Writes `payment_history` row (success/failure)
8. Sends success email + logs activity

### PayPal Currency Fallback

PayPal doesn't support all currencies (e.g., INR may fail). The backend has **automatic USD fallback**:

1. First attempt: Create order with original currency (e.g., INR)
2. If PayPal returns 400/422 with currency error → auto-retry with USD
3. Amount converted using `convertAmount()` helper
4. Checkout metadata records: `paypal_fallback: "currency_to_usd"`, original currency/amount, retry currency/amount

### PayPal DNS Fallback

`paypalFetchWithFallback()` tries multiple API base URLs in order:
1. Custom override from gateway config (if set)
2. `https://api-m.paypal.com` (or sandbox equivalent)
3. `https://api.paypal.com` (fallback if api-m fails DNS)

### PayPal Configuration

**Config source:** `payment_gateways` table (not .env)

```sql
SELECT * FROM payment_gateways WHERE gateway_key = 'paypal';
```

**config_json structure:**
```json
{
  "accounts": {
    "default": {
      "sandbox": {
        "client_id": "AV...",
        "client_secret": "EK..."
      },
      "live": {
        "client_id": "AX...",
        "client_secret": "EL..."
      }
    }
  },
  "active_mode": "sandbox",
  "active_account_id": "default"
}
```

**Manage via:** `PATCH /payment-gateways/:id` (Owner only)

### PayPal Environment Variables (Fallback)

Used only if `payment_gateways` table config is missing:

```env
PAYPAL_CLIENT_ID=AV...
PAYPAL_CLIENT_SECRET=EK...
PAYPAL_MODE=sandbox                    # sandbox or live
PAYPAL_API_BASE_URL=                   # optional override
```

### PayPal vs Stripe Comparison

| Aspect | Stripe | PayPal |
|--------|--------|--------|
| **Gateway key** | `stripe` | `paypal` |
| **Config source** | `.env` (STRIPE_SECRET_KEY) + payment_gateways | `payment_gateways` table (DB-first) |
| **Checkout type** | Stripe hosted checkout page | PayPal hosted approval page |
| **Session ID** | `cs_test_...` (Stripe session) | PayPal order ID |
| **Payment capture** | Auto-captured by Stripe | Explicit capture via `/capture` API |
| **Currency support** | 135+ currencies | Limited (auto-fallback to USD) |
| **Card handling** | On Stripe page (PCI compliant) | On PayPal page (PayPal/card/balance) |
| **Confirm flow** | Retrieve Stripe session → verify `payment_status` | Get order → capture if needed → verify `status` |
| **Return URL** | `?session_id={CHECKOUT_SESSION_ID}` | `?session_id={ORDER_ID}&gateway=paypal` |
| **DB writes** | Same (subscriptions + payment_history) | Same (subscriptions + payment_history) |

### PayPal Data Sent

| Field | What's Sent |
|-------|-------------|
| `amount` | Grand total after discount (2 decimal places) |
| `currency_code` | USD/EUR/GBP (auto-fallback from INR) |
| `description` | "Plan_Name Monthly/Yearly \| Org_Name" |
| `payer.name` | From billing address (given_name + surname) |
| `payer.email_address` | From billing form |
| `payer.address` | Full billing address (line1, line2, city, state, postal, country_code) |
| `return_url` | App success URL with order ID |
| `cancel_url` | App cancel URL |

No card numbers/CVV stored or handled by backend — all on PayPal's page.

### PayPal End-to-End Sequence

```
1. POST /billing/quote                    → Calculate pricing
2. POST /billing/checkout-session         → gateway: "paypal"
3. Backend: OAuth2 token → Create PayPal order
4. Frontend: Redirect to PayPal approve_url
5. User: Pay on PayPal page (login/card/balance)
6. PayPal: Redirect back → /app/admin?...&gateway=paypal
7. POST /billing/checkout/confirm         → session_id = PayPal order ID
8. Backend: Get order → Capture if needed → Verify COMPLETED
9. Backend: Update subscriptions + Write payment_history
10. Backend: Send success email + Log activity
11. Frontend: Show success + confetti + redirect to billing
```

### PayPal Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Unable to fetch PayPal access token` | Wrong client_id/secret | Check `payment_gateways` table config |
| `CURRENCY_NOT_SUPPORTED` | PayPal doesn't support currency | Auto-fallback to USD (built-in) |
| `PAYER_ACTION_REQUIRED` | User didn't complete PayPal approval | User needs to retry checkout |
| `ORDER_NOT_APPROVED` | Capture attempted before user approved | Check return URL flow |
| DNS lookup failure (ENOTFOUND) | PayPal API unreachable | Auto-fallback to alternate base URL |
| `Invalid PayPal order status` | Order expired or already captured | Check order status before capture |
