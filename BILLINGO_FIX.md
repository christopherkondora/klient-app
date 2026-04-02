# Billingo Invoicing Fix - Complete Guide

## Current Issue

Billingo invoicing is not working - payments complete successfully in Stripe, but no invoices are created in Billingo dashboard.

## Root Cause Analysis

Based on investigation across [KLIAA-41](/KLIAA/issues/KLIAA-41) and [KLIAA-33](/KLIAA/issues/KLIAA-33):

1. ✅ **Integration code exists** - `createBillingoInvoice()` function implemented
2. ✅ **Secrets are configured** - All three Billingo secrets are set
3. ⚠️  **Function may not be deployed with latest secrets** - Webhook needs redeployment
4. ⚠️  **Configuration values need verification** - Block ID and API key must match test environment

## Complete Fix (5 minutes)

### Step 1: Verify and Set Secrets

Run these commands to ensure correct configuration for **TEST/SANDBOX mode**:

```bash
# Set Billingo API key (from user comment)
supabase secrets set BILLINGO_API_KEY=ab379f0a-26dc-11f1-8e47-026634090519

# Set environment to sandbox for testing
supabase secrets set BILLINGO_ENV=sandbox

# Set correct test mode block ID (confirmed by user)
supabase secrets set BILLINGO_BLOCK_ID=314533
```

### Step 2: Redeploy Webhook Function

The function MUST be redeployed to pick up the updated secrets:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

**Important:** The `--no-verify-jwt` flag is required! Without it, Stripe webhooks will fail with 401 errors.

### Step 3: Test End-to-End

1. **Make a test payment** in the Klient app (any plan)

2. **Check Supabase Function Logs** immediately:
   - Go to Supabase Dashboard → Logs → Edge Functions
   - Filter for `stripe-webhook`
   - Look for these log entries:
     - `[Webhook] Event received: checkout.session.completed` ✅
     - `[Billingo] Using environment:` ✅ (confirms config loaded)
     - `[Billingo] Invoice created successfully:` ✅ (success!)
     - OR `[Billingo] Invoice creation failed:` ❌ (shows error details)

3. **Check Billingo Dashboard**:
   - Log in to Billingo test/sandbox account
   - Navigate to block **314533**
   - Verify the invoice appears with correct amount and customer

4. **Check Database**:
   - Go to Supabase → Table Editor → `subscriptions`
   - Find the subscription record
   - Verify `billingo_invoice_id` is populated (should be a number)
   - Verify `billingo_partner_id` is populated

## Diagnostic Script

If issues persist, run the diagnostic script to test Billingo API connection:

```bash
# Export the secrets locally for testing
export BILLINGO_API_KEY=ab379f0a-26dc-11f1-8e47-026634090519
export BILLINGO_ENV=sandbox
export BILLINGO_BLOCK_ID=314533

# Run diagnostic
deno run --allow-net --allow-env scripts/test-billingo.ts
```

This will verify:
- API key is valid ✅
- Can connect to Billingo API ✅
- Can access partners endpoint ✅
- Block ID is correctly configured ✅

## Common Issues

### Issue: "No API key configured" in logs
**Fix:** Secrets not set or function not redeployed. Repeat steps 1-2.

### Issue: "Invalid signature" or 401 errors
**Fix:** Webhook deployed without `--no-verify-jwt` flag. Redeploy with flag.

### Issue: "Invoice creation failed: Invalid block_id"
**Fix:** Wrong block ID. For test mode, must be **314533**. For production, use **315117**.

### Issue: "Partner creation failed"
**Fix:** Check API key has permission to create partners in Billingo. Verify in Billingo account settings.

## Production Readiness

**After test mode works**, for production:

```bash
supabase secrets set BILLINGO_API_KEY=<production_api_key>
supabase secrets set BILLINGO_ENV=production
supabase secrets set BILLINGO_BLOCK_ID=315117
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Related Issues

- [KLIAA-41](/KLIAA/issues/KLIAA-41) - Initial Billingo invoicing issue
- [KLIAA-33](/KLIAA/issues/KLIAA-33) - End-to-end Stripe validation (blocked by invoicing)

## Success Criteria

- ✅ Payment completes in Stripe
- ✅ Webhook returns 200 OK
- ✅ Supabase logs show `[Billingo] Invoice created successfully`
- ✅ Invoice appears in Billingo dashboard (block 314533)
- ✅ Database has `billingo_invoice_id` populated
- ✅ User sees success page (fixed separately in commit 112d25b)
