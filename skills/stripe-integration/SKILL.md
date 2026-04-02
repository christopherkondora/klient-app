---
name: stripe-integration
description: Use this skill when working with Stripe payment integration - covers webhook setup, test vs live keys, payment flow, subscription management, and production readiness. Essential for subscription and payment tasks.
---

# Stripe Integration

## Overview

Stripe handles all payment processing for Klient subscriptions. The integration supports three pricing tiers (monthly, yearly, lifetime) and automatically updates subscription status via webhooks.

**Integration Type:** Stripe Checkout (embedded in webview)
**Webhooks:** Supabase Edge Function
**Current Mode:** Test mode (`sk_test_...`)

---

## Architecture

```
User clicks "Subscribe"
       ↓
Frontend calls create-checkout Edge Function
       ↓
Edge Function creates Stripe Checkout Session
       ↓
Return checkout URL to frontend
       ↓
Open URL in <webview> (Electron)
       ↓
User completes payment
       ↓
Stripe redirects to /success
       ↓
Frontend detects success, closes webview, polls subscription
       ↓
┌────────────────────────────────────────┐
│  Stripe sends webhook to Edge Function │
│          ↓                              │
│  stripe-webhook validates signature     │
│          ↓                              │
│  Update subscriptions table             │
│          ↓                              │
│  Create Billingo invoice                │
└────────────────────────────────────────┘
```

---

## Components

### 1. Frontend (`src/components/Paywall.tsx`)

**Responsibilities:**
- Display pricing cards (monthly, yearly, lifetime)
- Call `create-checkout` Edge Function
- Open Stripe Checkout in embedded `<webview>`
- Poll subscription status after checkout
- Show celebration animation on success

**Key Functions:**
- `handleCheckout(plan)` - Initiates checkout flow
- `closeCheckout()` - Closes webview, starts polling
- `startPolling()` - Polls subscription every 2-3 seconds
- `refresh()` - Fetches latest subscription from Supabase

**Polling Logic:**
- After checkout closes: poll every 2s for 45s
- After subscription active detected: stop polling, show celebration

### 2. create-checkout Edge Function

**File:** `supabase/functions/create-checkout/index.ts`

**Purpose:** Creates Stripe Checkout Session for subscription purchase

**Flow:**
1. Verify user JWT (Supabase Auth)
2. Get plan from request body (`monthly`, `yearly`, `lifetime`)
3. Look up Price ID for plan
4. Create Stripe Checkout Session via Stripe API
5. Return checkout URL to frontend

**Price IDs (hardcoded, TEST MODE):**
```typescript
const PRICE_IDS: Record<string, string> = {
  monthly: 'price_1TECUdArzcPFCRN0k4CyvdG1',
  yearly: 'price_1TECVpArzcPFCRN0L7oY3FPc',
  lifetime: 'price_1TECWhArzcPFCRN0GWGwf92H',
};
```

**Metadata:** Includes `user_id` and `plan` in session metadata for webhook processing

### 3. stripe-webhook Edge Function

**File:** `supabase/functions/stripe-webhook/index.ts`

**Purpose:** Handles Stripe webhook events and updates subscription status

**Events Handled:**
- `checkout.session.completed` - Payment success, create/update subscription
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription status changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_failed` - Payment failed, mark past_due

**Security:** Validates webhook signature using `STRIPE_WEBHOOK_SECRET`

**Flow:**
1. Verify Stripe signature (HMAC SHA-256)
2. Parse event type
3. Extract `user_id` from metadata
4. Update `subscriptions` table in Supabase
5. If payment success: call `createBillingoInvoice()`

### 4. manage-subscription Edge Function

**File:** `supabase/functions/manage-subscription/index.ts`

**Purpose:** Cancel or reactivate subscriptions

**Actions:**
- `cancel` - Cancel subscription at period end (user keeps access until billing period ends)
- `reactivate` - Remove cancellation, restore active status

**Used by:** Settings page ("Cancel subscription" / "Reactivate subscription" buttons)

---

## Pricing

| Plan     | Price       | Stripe Mode | Description           |
|----------|-------------|-------------|-----------------------|
| Monthly  | 3,990 HUF   | subscription| Billed monthly        |
| Yearly   | 39,900 HUF  | subscription| Billed annually (2 months free) |
| Lifetime | 119,900 HUF | payment     | One-time payment      |

**Note:** Lifetime uses `mode: 'payment'` (one-time), not `mode: 'subscription'`

---

## Database Schema

### subscriptions Table (Supabase)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK(status IN ('trial', 'active', 'cancelled', 'expired', 'past_due')),
  plan TEXT NOT NULL CHECK(plan IN ('trial', 'monthly', 'yearly', 'lifetime')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Status Values:**
- `trial` - 14-day free trial (auto-created on signup)
- `active` - Paid subscription active
- `cancelled` - Subscription cancelled, access until period end
- `expired` - Subscription expired, no access
- `past_due` - Payment failed, retry in progress

**Triggers:**
- Auto-creates trial subscription on user signup
- Auto-updates `updated_at` on every change

---

## Test vs Production Mode

### Current State (Test Mode)

**API Key:** `STRIPE_SECRET_KEY=sk_test_...` (stored in Supabase secrets)

**Price IDs:** All start with `price_1TEC...` (test prices)

**Webhook:** Test mode webhook endpoint configured

**Test Cards:**
- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0000 0000 3220`
- Declined: `4000 0000 0000 9995`

### Production Readiness Checklist

See [KLIAA-4](/KLIAA/issues/KLIAA-4) for full checklist. Key items:

- [ ] Create production Stripe account (or switch to Live mode)
- [ ] Create 3 new Price objects in Live mode (monthly, yearly, lifetime)
- [ ] Update `PRICE_IDS` in `create-checkout/index.ts` to production prices
- [ ] Add `STRIPE_ENV` environment variable ("test" or "production")
- [ ] Set `STRIPE_SECRET_KEY` to production key (`sk_live_...`)
- [ ] Create webhook endpoint in Live mode Stripe Dashboard
- [ ] Configure webhook to send events to production Edge Function URL
- [ ] Set `STRIPE_WEBHOOK_SECRET` to Live mode webhook secret
- [ ] Verify success/cancel URLs (`klient.work/success`, `klient.work/cancel`) exist
- [ ] Add payment recovery mechanism (sync Stripe subscriptions to database)
- [ ] Test full end-to-end flow with real credit card (small amount first)

---

## Known Issues

### ✅ Fixed Issues (Phase 1)

1. ~~**Hardcoded Test Price IDs**~~ - FIXED
   - Now uses environment-based configuration with `STRIPE_ENV`
   - Separate `TEST_PRICE_IDS` and `PROD_PRICE_IDS`

2. ~~**No Test/Production Toggle**~~ - FIXED
   - `STRIPE_ENV` variable implemented
   - Automatic selection of correct price IDs

3. ~~**Success/Cancel URLs Hardcoded**~~ - FIXED
   - Now uses `APP_URL` environment variable
   - Defaults to `https://klient.work`

4. ~~**No Payment Recovery**~~ - FIXED
   - `sync-stripe-subscriptions` Edge Function implemented
   - Can manually or automatically reconcile Stripe state

5. ~~**Hardcoded Billingo block_id**~~ - FIXED (2026-03-31)
   - Now uses `BILLINGO_BLOCK_ID` environment variable
   - Defaults to 315117, configurable per environment

### ⚠️ Remaining Issues

6. **Webhook Manual Setup**
   - Webhook must be manually configured in Stripe Dashboard
   - No validation that webhook is set up correctly
   - Fix: Add healthcheck endpoint (optional)

7. **Lifetime Plan Tracking**
   - Lifetime purchases have no `stripe_subscription_id`
   - Harder to track, refund, or manage
   - Fix: Add `stripe_payment_id` column to subscriptions table (future enhancement)

8. **No Error Monitoring**
   - Errors logged but not alerted
   - Manual log review required
   - Fix: Add Sentry integration (planned in Phase 2E)

---

## Webhook Setup

### Events to Subscribe

**Required:**
- `checkout.session.completed` - Payment success
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_failed` - Payment failed

### Webhook Endpoint

**URL:** `https://arbhhltbjovuxwvfcnni.supabase.co/functions/v1/stripe-webhook`

**Method:** POST

**Headers:** `stripe-signature` (used for signature verification)

### Signature Verification

**Algorithm:** HMAC SHA-256

**Secret:** `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard)

**Timeout:** 5 minutes (rejects webhooks older than 5 minutes)

**Code:** `stripe-webhook/index.ts:12-43`

**Recommendation:** Increase timeout to 10 minutes to handle Stripe retries

---

## Testing

### Test Checklist

- [ ] Monthly subscription purchase → activates immediately
- [ ] Yearly subscription purchase → activates immediately
- [ ] Lifetime purchase → activates immediately, no subscription ID
- [ ] Payment with 3D Secure card → completes successfully
- [ ] Declined card → shows error, doesn't activate subscription
- [ ] Cancel subscription → status changes to `cancelled`, access until period end
- [ ] Reactivate cancelled subscription → status changes back to `active`
- [ ] Trial expires → status changes to `expired`, paywall appears
- [ ] Webhook signature validation → rejects tampered requests
- [ ] Webhook retry → processes delayed events correctly
- [ ] Billingo invoice created after successful payment
- [ ] Multiple purchases by same user → updates existing subscription

### Stripe CLI (for local testing)

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local Edge Function
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
```

---

## Monitoring & Alerts

### Metrics to Track

- Checkout session creation success rate
- Payment success rate (checkout.session.completed events)
- Webhook processing success rate
- Subscription status distribution (active, cancelled, expired, past_due)
- Revenue metrics (MRR, ARR, churn rate)

### Alerts to Set Up

- Payment failures (invoice.payment_failed)
- Webhook signature validation failures
- Subscription update failures (database write errors)
- High error rate in Edge Functions

**Recommendation:** Integrate with Sentry or Datadog for error tracking and alerting

---

## Subscription Management

### Cancel Flow

1. User clicks "Cancel subscription" in Settings
2. Frontend calls `manage-subscription` Edge Function with `action: "cancel"`
3. Edge Function calls Stripe API: `POST /subscriptions/{id}` with `cancel_at_period_end: true`
4. Edge Function updates subscriptions table: `status = 'cancelled'`
5. User keeps access until `current_period_end`
6. At period end, Stripe sends `customer.subscription.deleted` webhook
7. Webhook updates status to `expired`

### Reactivate Flow

1. User clicks "Reactivate subscription" in Settings
2. Frontend calls `manage-subscription` Edge Function with `action: "reactivate"`
3. Edge Function calls Stripe API: `POST /subscriptions/{id}` with `cancel_at_period_end: false`
4. Edge Function updates subscriptions table: `status = 'active'`
5. Subscription continues normally

### Update Payment Method

**Current:** Not implemented

**Recommendation:** Use Stripe Customer Portal:
```typescript
// Create portal session
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: 'https://klient.work/settings',
});
// Redirect user to session.url
```

---

## Security Considerations

### API Keys

**Test Key:** `sk_test_...` (safe to use in development)

**Live Key:** `sk_live_...` (NEVER commit to Git, store in Supabase secrets only)

**Webhook Secret:** `whsec_...` (used for signature verification)

### Webhook Signature Verification

**Purpose:** Prevents attackers from sending fake webhooks

**How it works:**
1. Stripe includes `stripe-signature` header
2. Header contains timestamp + HMAC signature
3. Webhook handler recomputes signature using `STRIPE_WEBHOOK_SECRET`
4. If signatures match, webhook is authentic

**Important:** Always verify signatures in production

### PCI Compliance

**Klient's Responsibility:** None (Stripe handles all card data)

**Stripe Checkout:** PCI DSS compliant, hosted by Stripe

**No card data** ever touches Klient's servers or database

---

## Future Improvements

### Phase 1 (Production Readiness)
- Create production prices
- Implement environment-based configuration
- Add payment recovery mechanism
- Verify success/cancel URLs exist
- Improve error handling and logging

### Phase 2 (Enhanced Features)
- Add payment method update flow (Stripe Customer Portal)
- Add subscription health dashboard (MRR, churn, etc.)
- Implement trial expiration notifications (email)
- Add retry logic for failed API calls
- Extend webhook signature timeout to 10 minutes

### Phase 3 (Advanced)
- Add subscription pause/resume (using Subscription Schedules API)
- Support coupons and discounts
- Add referral program (discount for referrals)
- Implement usage-based billing (if adding team features)

---

## Documentation Links

- **Stripe API Docs:** https://stripe.com/docs/api
- **Stripe Checkout:** https://stripe.com/docs/payments/checkout
- **Webhooks Guide:** https://stripe.com/docs/webhooks
- **Testing:** https://stripe.com/docs/testing
- **Setup Guide:** `STRIPE_SETUP.md`

---

## Quick Reference

```bash
# View Supabase secrets
supabase secrets list

# Set Stripe secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Deploy Edge Functions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy manage-subscription

# Test locally with Stripe CLI
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

---

## Questions for CEO

Before production deployment:

1. Do we have a production Stripe account set up?
2. Is the current API key test or production?
3. Is `klient.work` domain verified in Stripe?
4. Are the pricing amounts final (3,990 Ft, 39,900 Ft, 119,900 Ft)?
5. Should we offer discounts or promotions?
6. What is our refund policy (30 days, 7 days, no refunds)?
7. Who handles payment issues (CTO, CEO, support team)?
8. When do we need production ready?

See [KLIAA-4 plan](/KLIAA/issues/KLIAA-4#document-plan) for full list of questions and recommendations.
