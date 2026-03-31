# Klient Stripe Integration - Production Runbook

**Version:** 1.0
**Last Updated:** 2026-03-31
**Owner:** CTO

---

## Overview

This runbook provides operational procedures for the Klient Stripe payment integration in production. Use this guide for monitoring, troubleshooting, and responding to payment-related incidents.

**Critical Services:**
- Stripe (payment processing)
- Supabase Edge Functions (checkout, webhook, subscription management)
- Billingo API (invoicing)
- Supabase PostgreSQL (subscription state)

---

## Table of Contents

1. [Health Checks](#health-checks)
2. [Common Issues](#common-issues)
3. [Manual Recovery Procedures](#manual-recovery-procedures)
4. [Refund Process](#refund-process)
5. [Incident Response](#incident-response)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [On-Call Procedures](#on-call-procedures)
8. [Escalation Path](#escalation-path)

---

## Health Checks

### Daily Health Check (5 minutes)

1. **Stripe Dashboard Check**
   - Navigate to: https://dashboard.stripe.com
   - Check for failed payments in last 24h
   - Check for webhook delivery failures
   - Verify all webhooks are "Enabled"

2. **Supabase Logs Check**
   - Navigate to: Supabase Dashboard → Logs → Edge Functions
   - Filter: Last 24 hours, Level: Error/Warning
   - Look for patterns in `[Checkout]`, `[Webhook]`, `[Billingo]` logs

3. **Subscription State Check**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT
     status,
     COUNT(*) as count
   FROM subscriptions
   GROUP BY status
   ORDER BY status;

   -- Expected: mostly 'active' and 'trial', very few 'past_due' or 'expired'
   ```

### Weekly Health Check (15 minutes)

1. **Payment Recovery Sync**
   ```bash
   # Reconcile Stripe state with database
   curl -X POST https://[your-supabase-url]/functions/v1/sync-stripe-subscriptions \
     -H "Authorization: Bearer $SYNC_SECRET"
   ```
   - Review response for `updated` count
   - If `updated > 5`, investigate why subscriptions are out of sync

2. **Billingo Invoice Check**
   - Verify recent invoices in Billingo Dashboard
   - Check for failed invoice creations (shouldn't block payments, but needs fixing)

3. **Revenue Metrics**
   - Check Stripe Dashboard → Revenue
   - Compare with internal metrics
   - Investigate discrepancies

---

## Common Issues

### Issue 1: Payment Failed (invoice.payment_failed)

**Symptoms:**
- Stripe webhook event: `invoice.payment_failed`
- User's subscription status: `past_due`
- User reports payment declined

**Diagnosis:**
```sql
-- Check user's subscription state
SELECT * FROM subscriptions WHERE user_id = '<user-id>';
```

**Resolution:**
1. Verify card details are correct in Stripe Dashboard
2. Stripe will automatically retry payment (up to 4 times by default)
3. If card is valid but keeps failing, check for:
   - Insufficient funds
   - Card expired
   - Bank blocking international payments
4. Contact user to update payment method
5. User can update via Settings → Subscription → "Update Payment Method" (if implemented)

**Prevention:**
- Enable Stripe Smart Retries (in Stripe Dashboard → Settings → Billing)
- Set up email notifications for failed payments

---

### Issue 2: Webhook Not Received

**Symptoms:**
- User completed payment in Stripe
- Subscription not activated in app
- Paywall still showing after payment

**Diagnosis:**
1. Check Stripe Dashboard → Webhooks → View events
2. Look for delivery failures or 4xx/5xx responses
3. Check Supabase logs for webhook errors

**Resolution:**

**Option A: Manual Sync (Immediate)**
```bash
# Force sync subscriptions from Stripe
curl -X POST https://[your-supabase-url]/functions/v1/sync-stripe-subscriptions \
  -H "Authorization: Bearer $SYNC_SECRET"
```

**Option B: Manual Webhook Replay**
1. Go to Stripe Dashboard → Webhooks → Select webhook endpoint
2. Find the missed event (e.g., `checkout.session.completed`)
3. Click "···" → "Resend event"
4. Verify subscription activated

**Option C: Manual Database Update** (Last resort)
```sql
-- Only use if webhook replay fails
UPDATE subscriptions
SET
  status = 'active',
  plan = 'monthly', -- or 'yearly', 'lifetime'
  stripe_customer_id = 'cus_...',
  stripe_subscription_id = 'sub_...',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '1 month', -- or '1 year'
  updated_at = NOW()
WHERE user_id = '<user-id>';
```

**Prevention:**
- Set up automated sync cron job (every 15 minutes)
- Monitor webhook delivery success rate

---

### Issue 3: Duplicate Payment / Double Charge

**Symptoms:**
- User reports being charged twice
- Multiple subscriptions or payments for same user

**Diagnosis:**
```sql
-- Check for multiple subscriptions
SELECT * FROM subscriptions WHERE user_id = '<user-id>';
```
```
-- Check Stripe Dashboard → Payments → Search by customer email
```

**Resolution:**
1. **Identify the correct subscription:**
   - Check payment dates and amounts
   - Usually the first payment is correct

2. **Refund the duplicate:**
   - Follow [Refund Process](#refund-process) below
   - Issue full refund for duplicate charge

3. **Clean up database:**
   ```sql
   -- Deactivate incorrect subscription
   UPDATE subscriptions
   SET status = 'cancelled', updated_at = NOW()
   WHERE user_id = '<user-id>' AND id = '<incorrect-subscription-id>';
   ```

**Prevention:**
- This should be rare due to Stripe's idempotency
- If recurring, investigate race conditions in webhook handler

---

### Issue 4: Billingo Invoice Not Created

**Symptoms:**
- Payment successful in Stripe
- Subscription activated
- No invoice in Billingo Dashboard

**Diagnosis:**
1. Check Supabase logs for `[Billingo]` errors
2. Common causes:
   - Billingo API key expired/invalid
   - Partner creation failed
   - Wrong `BILLINGO_BLOCK_ID`

**Resolution:**
```bash
# Manually create invoice via Billingo API or Dashboard

# 1. Get payment details from Stripe
#    Stripe Dashboard → Search customer → View payment

# 2. Create invoice manually in Billingo
#    Billingo Dashboard → Documents → Create Invoice
#    - Customer: user's email
#    - Amount: payment amount (HUF)
#    - Description: "Klient [Monthly/Yearly/Lifetime] előfizetés"
```

**Important:** Invoice creation failure does NOT block payment processing. The subscription will still be active. The invoice is for accounting/legal purposes only.

**Prevention:**
- Verify `BILLINGO_API_KEY` and `BILLINGO_BLOCK_ID` are correct
- Set up alerts for Billingo API errors

---

## Manual Recovery Procedures

### Procedure 1: Force Subscription Activation

**When to use:** User paid but subscription stuck in trial/expired

```sql
-- 1. Get user ID from email
SELECT id FROM auth.users WHERE email = 'user@example.com';

-- 2. Get payment details from Stripe Dashboard
--    Note: customer_id, subscription_id, amount, plan

-- 3. Update subscription
UPDATE subscriptions
SET
  status = 'active',
  plan = 'monthly', -- or 'yearly', 'lifetime'
  stripe_customer_id = 'cus_...',
  stripe_subscription_id = 'sub_...', -- NULL for lifetime
  current_period_start = '<start-date>',
  current_period_end = '<end-date>',
  updated_at = NOW()
WHERE user_id = '<user-id>';

-- 4. Verify
SELECT * FROM subscriptions WHERE user_id = '<user-id>';
```

### Procedure 2: Emergency Webhook Disable

**When to use:** Webhook causing critical errors, need to stop processing

```bash
# 1. Disable webhook in Stripe Dashboard
#    Stripe Dashboard → Webhooks → [your-endpoint] → Disable

# 2. Fix the underlying issue in code

# 3. Re-deploy Edge Function
supabase functions deploy stripe-webhook

# 4. Re-enable webhook
#    Stripe Dashboard → Webhooks → [your-endpoint] → Enable

# 5. Replay missed events
#    Stripe Dashboard → Webhooks → View events → Resend
```

### Procedure 3: Bulk Subscription Sync

**When to use:** Database restore, suspected widespread sync issues

```bash
# Run payment recovery sync
curl -X POST https://[your-supabase-url]/functions/v1/sync-stripe-subscriptions \
  -H "Authorization: Bearer $SYNC_SECRET"

# Review results
# - total: number of subscriptions checked
# - updated: number of mismatches fixed
# - errors: number of failures
# - in_sync: number already correct

# If errors > 0, check Supabase logs for details
```

---

## Refund Process

### Full Refund (within 30 days for Lifetime, or for technical issues)

1. **Verify refund eligibility:**
   - Lifetime purchases: within 30 days
   - Recurring: technical issue preventing access
   - Check internal refund policy

2. **Issue refund in Stripe:**
   ```
   Stripe Dashboard → Payments → Search customer email → Select payment → Refund
   - Amount: Full amount
   - Reason: "requested_by_customer" or "duplicate"
   ```

3. **Update subscription status:**
   ```sql
   UPDATE subscriptions
   SET
     status = 'expired',
     updated_at = NOW()
   WHERE user_id = '<user-id>';
   ```

4. **Notify user:**
   - Email confirmation: "Your refund has been processed. It will appear in your account within 5-10 business days."

5. **Cancel Billingo invoice** (if applicable):
   - Billingo Dashboard → Find invoice → Cancel/Reverse

### Partial Refund (prorated for yearly cancellation)

1. **Calculate prorated amount:**
   ```
   days_used = (NOW() - subscription.current_period_start) / (24 * 60 * 60)
   days_total = 365
   amount_used = (yearly_price / days_total) * days_used
   refund_amount = yearly_price - amount_used
   ```

2. **Issue partial refund in Stripe:**
   ```
   Stripe Dashboard → Payments → Refund
   - Amount: [calculated-refund-amount]
   - Reason: "requested_by_customer"
   ```

3. **Update subscription:**
   ```sql
   UPDATE subscriptions
   SET
     status = 'cancelled',
     updated_at = NOW()
   WHERE user_id = '<user-id>';
   ```

---

## Incident Response

### Severity Levels

**P0 - Critical (Immediate response required)**
- All payments failing (> 90% failure rate)
- Webhook endpoint down
- Database corruption
- Security breach

**P1 - High (Response within 2 hours)**
- High payment failure rate (> 20%)
- Webhook delays > 1 hour
- Billingo API completely down

**P2 - Medium (Response within 1 business day)**
- Individual payment failures
- Billingo invoice creation failures
- Subscription sync issues

**P3 - Low (Response within 1 week)**
- UI/UX improvements
- Non-critical logging errors

### Incident Response Checklist

**For P0/P1 Incidents:**

1. **Acknowledge** (within 5 minutes)
   - Post in team chat: "Investigating payment issue, ETA 30 minutes"

2. **Assess Impact**
   - How many users affected?
   - Is money at risk?
   - What's the root cause?

3. **Mitigate**
   - Stop the bleeding (disable webhook if needed)
   - Prevent new failures

4. **Fix**
   - Deploy code fix or configuration change
   - Verify fix in production

5. **Recover**
   - Run manual sync if needed
   - Contact affected users

6. **Document**
   - Write incident postmortem
   - Update runbook with lessons learned

---

## Monitoring & Alerts

### Recommended Alerts

**Sentry (if integrated):**
- Email/SMS on ANY error in `stripe-webhook` Edge Function
- Email on ANY error in `create-checkout` Edge Function

**Supabase Logs:**
- Daily email digest of errors (if no Sentry)

**Stripe Dashboard:**
- Email on webhook delivery failure
- Email on payment disputes/chargebacks

**Manual Checks:**
- Daily: Stripe Dashboard, Supabase logs
- Weekly: Run sync tool, check revenue metrics

---

## On-Call Procedures

### On-Call Responsibilities

**CTO (primary):**
- Respond to P0/P1 incidents within 2 hours
- Execute manual recovery procedures
- Escalate to CEO if needed

**CEO (backup):**
- Approve emergency changes
- Handle customer communications
- Make business decisions (refunds, discounts)

### On-Call Rotation

Currently: CTO only (startup phase)

Future: Rotate on-call weekly when team grows

### After-Hours Response

**P0 Critical:** Wake up CTO immediately

**P1 High:** CTO checks within 2 hours (morning/evening)

**P2/P3:** Wait until business hours

---

## Escalation Path

1. **CTO** (technical issues, code fixes, manual procedures)
2. **CEO** (business decisions, refunds, customer communication)
3. **Stripe Support** (Stripe API issues, webhook problems)
   - Email: support@stripe.com
   - Dashboard: https://dashboard.stripe.com/support
4. **Billingo Support** (invoice API issues)
   - Email: support@billingo.hu

---

## Emergency Contacts

**Internal:**
- CTO: [phone]
- CEO: [phone]

**External:**
- Stripe Support: https://dashboard.stripe.com/support
- Billingo Support: support@billingo.hu
- Supabase Support: https://supabase.com/support

---

## Useful Links

- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: [your-supabase-url]
- Billingo Dashboard: https://app.billingo.hu
- Sentry Dashboard: [if integrated]
- STRIPE_SETUP.md: ./STRIPE_SETUP.md
- skills/stripe-integration.md: ./skills/stripe-integration.md

---

## Changelog

| Date       | Change                                      | Author |
|------------|---------------------------------------------|--------|
| 2026-03-31 | Initial production runbook created          | CTO    |

