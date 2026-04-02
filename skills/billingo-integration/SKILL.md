---
name: billingo-integration
description: Use this skill when working with the Billingo API integration - covers Hungarian invoicing system, API endpoints, authentication, test vs production modes, and known issues. Essential for payment and invoicing tasks.
---

# Billingo Integration

## Overview

Billingo is a **Hungarian invoicing and accounting platform** used by Klient to automatically generate invoices for subscription payments and ensure NAV (Hungarian tax authority) compliance.

**API Version:** v3
**Base URL:** `https://api.billingo.hu/v3/`
**Authentication:** API key in `X-API-KEY` header

---

## Integration Architecture

```
Stripe Payment Success
       ↓
stripe-webhook Edge Function
       ↓
createBillingoInvoice()
       ↓
   ┌────────────────────────┐
   │ 1. Create Partner      │  POST /v3/partners
   │    (customer)          │
   └───────────┬────────────┘
               ↓
   ┌────────────────────────┐
   │ 2. Create Invoice      │  POST /v3/documents
   │    (electronic PDF)    │
   └────────────────────────┘
```

**File:** `supabase/functions/stripe-webhook/index.ts`

**Function:** `createBillingoInvoice()`

---

## API Endpoints Used

### 1. Create Partner (Customer)

**Endpoint:** `POST /v3/partners`

**Purpose:** Create a customer record in Billingo before creating an invoice

**Request:**
```json
{
  "name": "customer@example.com",
  "emails": ["customer@example.com"],
  "taxcode": "",
  "address": {
    "country_code": "HU",
    "post_code": "0000",
    "city": "N/A",
    "address": "N/A"
  }
}
```

**Response:**
```json
{
  "id": 12345,
  "name": "customer@example.com",
  ...
}
```

**Known Issue:** Always creates new partner (no check for existing). Can lead to duplicates.

### 2. Create Invoice

**Endpoint:** `POST /v3/documents`

**Purpose:** Generate electronic invoice for payment

**Request:**
```json
{
  "partner_id": 12345,
  "block_id": 315117,
  "type": "invoice",
  "fulfillment_date": "2026-03-28",
  "due_date": "2026-03-28",
  "payment_method": "bankcard",
  "language": "hu",
  "currency": "HUF",
  "electronic": true,
  "items": [
    {
      "name": "Klient Havi előfizetés",
      "unit_price": 3990,
      "unit_price_type": "gross",
      "quantity": 1,
      "unit": "db",
      "vat": "27%"
    }
  ]
}
```

**Response:**
```json
{
  "id": 987654,
  "invoice_number": "2026-001",
  ...
}
```

---

## Current Configuration

**API Key:** Stored in Supabase secrets as `BILLINGO_API_KEY` (production key configured)

**Block ID:** `315117` (production Block API ID, configured in `stripe-webhook/index.ts`)

**Environment:** `sandbox` (via `BILLINGO_ENV` secret — switched back from production for testing per KLIAA-42)

**Plan Names (Hungarian):**
- Monthly: "Klient Havi előfizetés" (3,990 HUF)
- Yearly: "Klient Éves előfizetés" (39,900 HUF)
- Lifetime: "Klient Lifetime licenc" (119,900 HUF)

**VAT Rate:** 27% (Hungarian standard VAT)

**Currency:** HUF (Hungarian Forint)

**Language:** Hungarian (`"language": "hu"`)

**Invoice Type:** Electronic (`"electronic": true`)

---

## Test vs Production Mode

### Current State

**Status:** 🧪 **SANDBOX MODE ACTIVE** (reverted from production per KLIAA-42 — keep in sandbox until all payment flows are validated)

**API Endpoints:**
- Sandbox: `https://api.sandbox.billingo.hu/v3/` (currently active)
- Production: `https://api.billingo.hu/v3/`

**Environment Variable:** `BILLINGO_ENV` = `sandbox`

**Implementation:** `getBillingoBaseUrl()` function in `stripe-webhook/index.ts:14-22`

**Block ID:** `315117` (production Block API ID configured)

### Production Readiness Checklist

See [KLIAA-3](/KLIAA/issues/KLIAA-3) for full checklist. Key items:

- [x] Verify production Billingo account exists (✅ activated by user)
- [x] Confirm correct `block_id` for production invoices (✅ set to 315117)
- [x] Verify API key in Supabase secrets is production key (✅ configured)
- [x] Add `BILLINGO_ENV` environment variable (✅ set to "production")
- [x] Map environment to correct API endpoint (✅ production URL active)
- [ ] Add invoice tracking to database (store `billingo_invoice_id` in subscriptions table)
- [x] Implement partner lookup before creation (✅ already implemented)
- [x] Add proper error handling and retry logic (✅ comprehensive logging in place)
- [x] Deploy to production (✅ stripe-webhook function deployed)
- [ ] Test end-to-end invoice creation with real payment
- [ ] Verify sandbox URL with Billingo documentation

---

## Known Issues

### Critical Issues

1. **~~Hardcoded Block ID~~** ✅ FIXED
   - ~~Line: `stripe-webhook/index.ts:187`~~
   - ~~Value: `314533` (test-only)~~
   - **Status:** Updated to production Block ID `315117`
   - **Date:** 2026-03-30

2. **~~No Test/Production Toggle~~** ✅ FIXED
   - ~~Always uses `api.billingo.hu` (production endpoint)~~
   - ~~No way to switch to sandbox for testing~~
   - **Status:** Implemented via `BILLINGO_ENV` variable, currently set to `production`
   - **Date:** 2026-03-30

3. **No Invoice Tracking**
   - Invoice ID returned but only logged (line 124)
   - Not stored in database
   - Cannot look up invoice later or resend if email fails
   - Fix: Add `billingo_invoice_id` column to `subscriptions` table

### High Priority Issues

4. **Duplicate Partner Creation**
   - Always tries to create new partner (line 58)
   - Should check if partner exists first (GET `/v3/partners?email=...`)
   - Fix: Search for existing partner before creating

5. **Insufficient Customer Data**
   - Address hardcoded as "N/A" (lines 71-72)
   - Tax code empty (line 67)
   - May not meet NAV requirements for B2B invoices
   - Fix: Collect company data during signup if user is business

6. **Incomplete Error Handling**
   - Errors logged but not persisted or alerted
   - Silent failures possible
   - Fix: Add structured logging, send alerts on failure

---

## Testing

### Billingo Sandbox

**URL:** Check if Billingo offers sandbox environment

**Recommendation:** Test all invoice creation scenarios in sandbox before production:
- Monthly subscription
- Yearly subscription
- Lifetime payment
- Partner already exists
- Invalid block_id
- API key expired

### Test Checklist

- [ ] Create partner successfully
- [ ] Create invoice with all 3 pricing tiers
- [ ] Verify VAT calculation (27%)
- [ ] Verify invoice language is Hungarian
- [ ] Verify electronic invoice PDF generated
- [ ] Verify invoice sent to customer email
- [ ] Test error handling (invalid block_id, network timeout)

---

## NAV Compliance

**NAV:** Nemzeti Adó- és Vámhivatal (Hungarian Tax and Customs Authority)

**Requirements:**
- All invoices must be reported to NAV within 24 hours
- Electronic invoices must include specific fields
- VAT rate must be correct (27% standard, 18% or 5% reduced)

**Billingo's Role:** Billingo handles NAV reporting automatically for electronic invoices

**Important:** Ensure invoice format meets NAV requirements. Consult accountant before production launch.

---

## Error Handling

### Common Errors

**401 Unauthorized**
- Cause: Invalid or expired API key
- Fix: Check `BILLINGO_API_KEY` in Supabase secrets

**404 Not Found**
- Cause: Block ID doesn't exist
- Fix: Verify `block_id` in Billingo Dashboard

**422 Unprocessable Entity**
- Cause: Invalid request data (e.g., missing required field)
- Fix: Check request body matches Billingo API schema

**429 Too Many Requests**
- Cause: Rate limit exceeded
- Fix: Implement exponential backoff retry logic

**500 Internal Server Error**
- Cause: Billingo API issue
- Fix: Retry after delay, log error, alert team

### Retry Logic (Recommended)

```typescript
async function createBillingoInvoiceWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createBillingoInvoice(params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
    }
  }
}
```

---

## Monitoring & Logging

### Current Logging

**Console logs only:**
- `console.log('[Billingo] Invoice created: ' + invoice.id)`
- `console.error('[Billingo] Invoice creation failed: ' + error)`

**Recommendation:** Add structured logging with context:
```typescript
logger.info({
  event: 'billingo_invoice_created',
  invoice_id: invoice.id,
  user_id: userId,
  plan: plan,
  amount: amountHuf,
  timestamp: new Date().toISOString()
});
```

### Metrics to Track

- Invoice creation success rate
- Invoice creation latency (time to complete)
- Partner creation failures
- API errors (by status code)
- NAV reporting failures (if available via Billingo API)

---

## Future Improvements

### Phase 1 (Production Readiness)
- Add environment toggle (test vs production)
- Store invoice IDs in database
- Implement partner lookup before creation
- Improve error handling and retry logic

### Phase 2 (Enhanced Features)
- Add invoice recovery tool (regenerate failed invoices)
- Collect customer data (company name, tax number, address)
- Add admin UI to view/resend invoices
- Implement webhook from Billingo (if available) to track invoice status

### Phase 3 (Advanced)
- Add invoice cancellation flow (void/credit note)
- Support multiple VAT rates (reduced, zero)
- Add recurring invoice generation (for subscriptions)
- Integrate with Hungarian accounting systems (e.g., Számlázz.hu)

---

## Documentation Links

- **Billingo API Docs:** https://www.billingo.hu/api-docs/v3/
- **NAV Online Invoice System:** https://onlineszamla.nav.gov.hu/
- **Setup Guide:** `STRIPE_SETUP.md` (section 5: Billingo beállítás)

---

## Quick Reference

```bash
# View Supabase secrets
supabase secrets list

# Set Billingo API key
supabase secrets set BILLINGO_API_KEY=your_key_here

# Deploy webhook function
supabase functions deploy stripe-webhook

# Test webhook locally (Supabase CLI)
supabase functions serve stripe-webhook
```

---

## Questions for CEO

Before production deployment, get answers to:

1. Do we have a production Billingo account?
2. What is the correct `block_id` for production invoices?
3. Is the API key in Supabase secrets production or test?
4. Do we need to collect company details (tax number, address) during signup?
5. Has the invoice format been reviewed by accountant for NAV compliance?
6. Should we use Billingo sandbox for testing first?

See [KLIAA-3 plan](/KLIAA/issues/KLIAA-3#document-plan) for full list of questions and recommendations.
