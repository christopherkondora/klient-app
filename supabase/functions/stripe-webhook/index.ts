import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { signBillingPortalToken } from '../_shared/hmac-token.ts';
import { welcomeEmail, lifetimeWelcomeEmail, renewalEmail, dunningEmail, planLabelHu, planAmountHu } from '../_shared/email-templates.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BILLINGO_API_KEY = Deno.env.get('BILLINGO_API_KEY') || '';
const STRIPE_ENV = Deno.env.get('STRIPE_ENV') || 'test';
const BILLINGO_ENV = Deno.env.get('BILLINGO_ENV') || 'sandbox';
const BILLINGO_BLOCK_ID = parseInt(Deno.env.get('BILLINGO_BLOCK_ID') || '315117', 10);
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const BILLING_PORTAL_TOKEN_SECRET = Deno.env.get('BILLING_PORTAL_TOKEN_SECRET') || '';
const BILLING_EVENT_TABLE = 'subscription_billing_events';
const RESEND_FROM = 'Kristóf a Klient-től <hello@klient.work>';

// Supabase client with service_role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type BillingModule = 'klient' | 'ads';
type BillingEventStatus = 'processing' | 'processed' | 'skipped' | 'failed';

interface BillingoInvoiceResult {
  invoiceId: number;
  partnerId: number;
  emailSent: boolean;
  emailError?: string;
}

// Discriminated outcome so callers can persist the Billingo failure reason
// (status + error_detail) instead of losing it once function logs roll off.
type BillingoInvoiceOutcome =
  | ({ ok: true } & BillingoInvoiceResult)
  | { ok: false; error: string };

interface BillingoPartnerAddress {
  country_code: string;
  post_code: string;
  city: string;
  address: string;
}

interface BillingEventInput {
  stripeEventId: string;
  stripeEventType: string;
  stripeInvoiceId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  userId?: string | null;
  module: BillingModule;
  plan?: string | null;
  customerEmail?: string | null;
}

interface SubscriptionLookup {
  userId: string;
  module: BillingModule;
  plan: string;
}

// ─── Billingo API base URL selection ───
function getBillingoBaseUrl(): string {
  // Billingo does not have a separate sandbox URL (api.sandbox.billingo.hu does not exist).
  // Test vs production is determined by which API key and Block ID you use.
  // Always use the production API endpoint.
  return 'https://api.billingo.hu/v3';
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readMetadata(value: unknown): Record<string, string> {
  const objectValue = readObject(value);
  return Object.fromEntries(
    Object.entries(objectValue).filter(([, entry]) => typeof entry === 'string')
  ) as Record<string, string>;
}

function getStripeEventId(event: { id?: string; type: string }, obj: Record<string, unknown>): string {
  return event.id || `${event.type}:${readString(obj.id)}`;
}

function getNestedEmail(obj: Record<string, unknown>): string {
  const customerDetails = readObject(obj.customer_details);
  return readString(obj.customer_email)
    || readString(customerDetails.email)
    || readString(obj.receipt_email);
}

function getNestedCustomerName(obj: Record<string, unknown>): string {
  const customerDetails = readObject(obj.customer_details);
  return readString(customerDetails.name)
    || readString(obj.customer_name);
}

function getNestedCustomerAddress(obj: Record<string, unknown>): BillingoPartnerAddress | null {
  const customerDetails = readObject(obj.customer_details);
  const detailsAddress = readObject(customerDetails.address);
  const invoiceAddress = readObject(obj.customer_address);
  const addr = Object.keys(detailsAddress).length ? detailsAddress : invoiceAddress;
  const city = readString(addr.city);
  const line1 = readString(addr.line1);
  const line2 = readString(addr.line2);
  const postalCode = readString(addr.postal_code);
  const country = readString(addr.country);
  if (!city && !line1 && !postalCode) return null;
  return {
    country_code: country || 'HU',
    post_code: postalCode || '0000',
    city: city || 'N/A',
    address: [line1, line2].filter(Boolean).join(', ') || 'N/A',
  };
}

function getNestedCustomerTaxCode(obj: Record<string, unknown>): string {
  const customerDetails = readObject(obj.customer_details);
  const detailsTaxIds = Array.isArray(customerDetails.tax_ids)
    ? customerDetails.tax_ids as Array<Record<string, unknown>>
    : [];
  const invoiceTaxIds = Array.isArray(obj.customer_tax_ids)
    ? obj.customer_tax_ids as Array<Record<string, unknown>>
    : [];
  const firstTaxId = detailsTaxIds[0] || invoiceTaxIds[0];
  return readString(firstTaxId?.value);
}

function getStripeInvoiceAmountHuf(obj: Record<string, unknown>): number {
  const amount = Number(obj.amount_paid ?? obj.total ?? obj.amount_due ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const currency = readString(obj.currency).toUpperCase();
  if (currency && currency !== 'HUF') {
    console.warn('[Webhook] Stripe invoice currency is not HUF, using raw amount for Billingo:', {
      invoice_id: obj.id,
      currency,
      amount,
    });
  }
  return Math.round(amount);
}

function getPlanFromStripeInvoice(obj: Record<string, unknown>, fallbackPlan: string | null | undefined): string {
  if (fallbackPlan && fallbackPlan !== 'trial') return fallbackPlan;

  const lines = readObject(obj.lines);
  const data = Array.isArray(lines.data) ? lines.data as Array<Record<string, unknown>> : [];
  const price = readObject(readObject(data[0]?.price).recurring);
  return readString(price.interval) === 'year' ? 'yearly' : 'monthly';
}

async function getAuthUserEmail(userId: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error('[Webhook] Could not load auth user email:', { user_id: userId, error });
    return '';
  }
  return data.user?.email || '';
}

async function findSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<SubscriptionLookup | null> {
  const { data: mainSub, error: mainLookupErr } = await supabase
    .from('subscriptions')
    .select('user_id, plan')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (mainSub) {
    return {
      userId: mainSub.user_id as string,
      module: 'klient',
      plan: (mainSub.plan as string | null) || 'monthly',
    };
  }

  const { data: adsSub, error: adsLookupErr } = await supabase
    .from('subscriptions')
    .select('user_id, ads_plan')
    .eq('ads_stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (adsSub) {
    return {
      userId: adsSub.user_id as string,
      module: 'ads',
      plan: (adsSub.ads_plan as string | null) || 'monthly',
    };
  }

  console.error('[Webhook] Subscription not found for Stripe subscription:', {
    subscription_id: subscriptionId,
    main_error: mainLookupErr,
    ads_error: adsLookupErr,
  });
  return null;
}

async function beginBillingEvent(input: BillingEventInput): Promise<{ shouldProcess: boolean; tableAvailable: boolean }> {
  const payload = {
    stripe_event_id: input.stripeEventId,
    stripe_event_type: input.stripeEventType,
    stripe_invoice_id: input.stripeInvoiceId || null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    stripe_subscription_id: input.stripeSubscriptionId || null,
    user_id: input.userId || null,
    module: input.module,
    plan: input.plan || null,
    customer_email: input.customerEmail || null,
    status: 'processing' as BillingEventStatus,
  };

  const { error } = await supabase.from(BILLING_EVENT_TABLE).insert(payload);
  if (!error) return { shouldProcess: true, tableAvailable: true };

  if (error.code === '42P01') {
    console.warn('[Webhook] Billing event table missing; processing without idempotency:', {
      stripe_event_id: input.stripeEventId,
    });
    return { shouldProcess: true, tableAvailable: false };
  }

  if (error.code === '23505') {
    const { data: existing, error: selectErr } = await supabase
      .from(BILLING_EVENT_TABLE)
      .select('id, status, billingo_invoice_id')
      .eq('stripe_event_id', input.stripeEventId)
      .maybeSingle();

    if (selectErr) {
      console.error('[Webhook] Could not read duplicate billing event:', {
        stripe_event_id: input.stripeEventId,
        error: selectErr,
      });
      return { shouldProcess: false, tableAvailable: true };
    }

    let duplicate = existing;
    if (!duplicate && input.stripeInvoiceId) {
      const { data: invoiceDuplicate, error: invoiceDuplicateErr } = await supabase
        .from(BILLING_EVENT_TABLE)
        .select('id, status, billingo_invoice_id')
        .eq('stripe_invoice_id', input.stripeInvoiceId)
        .maybeSingle();

      if (invoiceDuplicateErr) {
        console.error('[Webhook] Could not read duplicate invoice billing event:', {
          stripe_invoice_id: input.stripeInvoiceId,
          error: invoiceDuplicateErr,
        });
        return { shouldProcess: false, tableAvailable: true };
      }
      duplicate = invoiceDuplicate;
    }

    if (duplicate?.status === 'failed') {
      await supabase.from(BILLING_EVENT_TABLE).update({
        ...payload,
        error: null,
        billingo_email_error: null,
      }).eq('id', duplicate.id);
      return { shouldProcess: true, tableAvailable: true };
    }

    console.log('[Webhook] Billing event already handled, skipping duplicate:', {
      stripe_event_id: input.stripeEventId,
      stripe_invoice_id: input.stripeInvoiceId,
      status: duplicate?.status,
      billingo_invoice_id: duplicate?.billingo_invoice_id,
    });
    return { shouldProcess: false, tableAvailable: true };
  }

  console.error('[Webhook] Could not create billing event log row; processing anyway:', {
    stripe_event_id: input.stripeEventId,
    error,
  });
  return { shouldProcess: true, tableAvailable: false };
}

async function finishBillingEvent(stripeEventId: string, patch: {
  status: BillingEventStatus;
  billingoInvoiceId?: number;
  billingoPartnerId?: number;
  billingoEmailSent?: boolean;
  billingoEmailError?: string;
  resendEmailId?: string;
  resendEmailSent?: boolean;
  resendEmailError?: string;
  error?: string;
}): Promise<void> {
  const { error } = await supabase.from(BILLING_EVENT_TABLE).update({
    status: patch.status,
    billingo_invoice_id: patch.billingoInvoiceId ? String(patch.billingoInvoiceId) : undefined,
    billingo_partner_id: patch.billingoPartnerId,
    billingo_email_sent: patch.billingoEmailSent ?? false,
    billingo_email_error: patch.billingoEmailError || null,
    resend_email_id: patch.resendEmailId || null,
    resend_email_sent: patch.resendEmailSent ?? false,
    resend_email_error: patch.resendEmailError || null,
    error: patch.error || null,
  }).eq('stripe_event_id', stripeEventId);

  if (error && error.code !== '42P01') {
    console.error('[Webhook] Could not update billing event log:', { stripe_event_id: stripeEventId, error });
  }
}

interface ResendResult {
  emailId?: string;
  sent: boolean;
  error?: string;
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  userId: string;
  eventType: string;
}): Promise<ResendResult> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] No API key configured, skipping email:', { event_type: params.eventType, to: params.to });
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const body = await res.json();

    if (res.ok) {
      console.log('[Resend] Email sent:', { event_type: params.eventType, to: params.to, id: body.id, user_id: params.userId });
      return { sent: true, emailId: body.id as string | undefined };
    }

    const errMsg = (body as Record<string, unknown>).message as string || `HTTP ${res.status}`;
    console.error('[Resend] Send failed:', { event_type: params.eventType, to: params.to, status: res.status, error: errMsg, user_id: params.userId });
    return { sent: false, error: errMsg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Resend] Unexpected error:', { event_type: params.eventType, to: params.to, error: message, user_id: params.userId });
    return { sent: false, error: message };
  }
}

function getCustomerDisplayName(email: string, name?: string): string {
  if (name && name.trim()) return name.trim().split(' ')[0];
  return email.split('@')[0] || 'Kedves előfizető';
}

// Sends the post-checkout welcome email (lifetime vs. monthly/yearly variants).
async function sendWelcomeResend(params: {
  plan: string;
  customerEmail: string;
  displayName: string;
  userId: string;
  eventType: string;
}): Promise<ResendResult> {
  if (params.plan === 'lifetime') {
    return sendResendEmail({
      to: params.customerEmail,
      subject: 'Köszönjük! Lifetime hozzáférésed aktiválva ✓',
      html: lifetimeWelcomeEmail(params.displayName),
      userId: params.userId,
      eventType: params.eventType,
    });
  }
  return sendResendEmail({
    to: params.customerEmail,
    subject: 'Üdvözöl a Klient! ✓',
    html: welcomeEmail(params.displayName, planLabelHu(params.plan)),
    userId: params.userId,
    eventType: params.eventType,
  });
}

async function sendBillingoInvoice(invoiceId: number, email: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: 'Missing customer email' };
  }

  try {
    const sendRes = await fetch(`${getBillingoBaseUrl()}/documents/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails: [email] }),
    });

    if (sendRes.ok) {
      console.log('[Billingo] Invoice email sent successfully:', {
        timestamp: new Date().toISOString(),
        user_id: userId,
        invoice_id: invoiceId,
        email,
      });
      return { success: true };
    }

    const errorText = await sendRes.text();
    console.error('[Billingo] Invoice email send failed:', {
      timestamp: new Date().toISOString(),
      user_id: userId,
      invoice_id: invoiceId,
      email,
      status: sendRes.status,
      status_text: sendRes.statusText,
      error_detail: errorText,
    });
    return { success: false, error: errorText || `HTTP ${sendRes.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Billingo] Unexpected invoice email send error:', {
      timestamp: new Date().toISOString(),
      user_id: userId,
      invoice_id: invoiceId,
      email,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ─── Stripe signature verification using Web Crypto ───
async function verifyStripeSignature(payload: string, sigHeader: string): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === signature;
}

// ─── Billingo invoice creation ───
async function createBillingoInvoice(params: {
  customerEmail: string;
  customerName?: string;
  customerAddress?: BillingoPartnerAddress | null;
  customerTaxCode?: string;
  plan: string;
  amountHuf: number;
  userId: string;
  stripeReference?: string;
  sendEmail?: boolean;
}): Promise<BillingoInvoiceOutcome> {
  if (!BILLINGO_API_KEY) {
    console.log('[Billingo] No API key configured, skipping invoice');
    return { ok: false, error: 'Billingo API key not configured' };
  }

  if (!params.customerEmail) {
    console.error('[Billingo] Missing customer email, skipping invoice:', {
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      plan: params.plan,
      amount: params.amountHuf,
    });
    return { ok: false, error: 'Missing customer email' };
  }

  const billingoBaseUrl = getBillingoBaseUrl();
  console.log('[Billingo] Using environment:', {
    timestamp: new Date().toISOString(),
    environment: BILLINGO_ENV,
    baseUrl: billingoBaseUrl,
    user_id: params.userId,
    plan: params.plan,
    amount: params.amountHuf,
  });

  try {
    // First, check if partner already exists
    const searchRes = await fetch(`${billingoBaseUrl}/partners`, {
      method: 'GET',
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    let partnerId: number;

    if (searchRes.ok) {
      const partnersData = await searchRes.json();
      const partners = partnersData.data || partnersData;

      // Find existing partner by email (case-insensitive)
      const existing = Array.isArray(partners)
        ? partners.find((p: any) => {
            const emails = p.emails || [];
            return emails.some((email: string) =>
              email.toLowerCase() === params.customerEmail.toLowerCase()
            );
          })
        : null;

      if (existing) {
        partnerId = existing.id;
        if (params.customerName || params.customerAddress || params.customerTaxCode) {
          const updateBody: Record<string, unknown> = {
            name: params.customerName || existing.name || params.customerEmail,
            emails: existing.emails?.length ? existing.emails : [params.customerEmail],
            taxcode: params.customerTaxCode || existing.taxcode || '',
            address: params.customerAddress || existing.address,
            type: existing.type || 'company',
          };

          const updateRes = await fetch(`${billingoBaseUrl}/partners/${partnerId}`, {
            method: 'PUT',
            headers: {
              'X-API-KEY': BILLINGO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateBody),
          });

          if (!updateRes.ok) {
            console.warn('[Billingo] Existing partner update failed, continuing with existing partner:', {
              timestamp: new Date().toISOString(),
              partner_id: partnerId,
              status: updateRes.status,
              error_detail: await updateRes.text(),
            });
          }
        }
        console.log('[Billingo] Using existing partner:', {
          timestamp: new Date().toISOString(),
          partner_id: partnerId,
          email: params.customerEmail,
          user_id: params.userId,
        });
      } else {
        // Create new partner if not found
        const partnerRes = await fetch(`${billingoBaseUrl}/partners`, {
          method: 'POST',
          headers: {
            'X-API-KEY': BILLINGO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: params.customerName || params.customerEmail,
            emails: [params.customerEmail],
            taxcode: params.customerTaxCode || '',
            address: params.customerAddress || {
              country_code: 'HU',
              post_code: '0000',
              city: 'N/A',
              address: 'N/A',
            },
            type: 'company',
          }),
        });

        if (partnerRes.ok) {
          const partner = await partnerRes.json();
          partnerId = partner.id;
          console.log('[Billingo] New partner created:', {
            timestamp: new Date().toISOString(),
            partner_id: partnerId,
            email: params.customerEmail,
            user_id: params.userId,
          });
        } else {
          const errorText = await partnerRes.text();
          console.error('[Billingo] Partner creation failed:', {
            timestamp: new Date().toISOString(),
            user_id: params.userId,
            email: params.customerEmail,
            status: partnerRes.status,
            status_text: partnerRes.statusText,
            error_detail: errorText,
            plan: params.plan,
            amount: params.amountHuf,
          });
          return { ok: false, error: `Partner creation failed (${partnerRes.status} ${partnerRes.statusText}): ${errorText.slice(0, 500)}` };
        }
      }
    } else {
      const errorText = await searchRes.text();
      console.error('[Billingo] Partner search failed:', {
        timestamp: new Date().toISOString(),
        user_id: params.userId,
        email: params.customerEmail,
        status: searchRes.status,
        status_text: searchRes.statusText,
        error_detail: errorText,
      });
      return { ok: false, error: `Partner search failed (${searchRes.status} ${searchRes.statusText}): ${errorText.slice(0, 500)}` };
    }

    const planNames: Record<string, string> = {
      monthly: 'Klient Havi előfizetés',
      yearly: 'Klient Éves előfizetés',
      lifetime: 'Klient Lifetime licenc',
      ads_monthly: 'Klient Ads Havi előfizetés',
      ads_yearly: 'Klient Ads Éves előfizetés',
    };

    const documentBody: Record<string, unknown> = {
      partner_id: partnerId,
      block_id: BILLINGO_BLOCK_ID,
      type: 'invoice',
      fulfillment_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      payment_method: 'bankcard',
      language: 'hu',
      currency: 'HUF',
      electronic: true,
      items: [
        {
          name: planNames[params.plan] || 'Klient előfizetés',
          unit_price: params.amountHuf,
          unit_price_type: 'net',
          quantity: 1,
          unit: 'db',
          vat: 'AAM',
        },
      ],
    };
    if (params.stripeReference) {
      documentBody.vendor_id = params.stripeReference;
    }

    // Create the invoice
    const invoiceRes = await fetch(`${billingoBaseUrl}/documents`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentBody),
    });

    if (invoiceRes.ok) {
      const invoice = await invoiceRes.json();
      let emailSent = false;
      let emailError: string | undefined;

      if (params.sendEmail !== false) {
        const sendResult = await sendBillingoInvoice(invoice.id, params.customerEmail, params.userId);
        emailSent = sendResult.success;
        emailError = sendResult.error;
      }

      console.log('[Billingo] Invoice created successfully:', {
        timestamp: new Date().toISOString(),
        user_id: params.userId,
        invoice_id: invoice.id,
        plan: params.plan,
        amount: params.amountHuf,
        partner_id: partnerId,
        email: params.customerEmail,
        email_sent: emailSent,
      });
      return { ok: true, invoiceId: invoice.id, partnerId, emailSent, emailError };
    } else {
      const errorText = await invoiceRes.text();
      console.error('[Billingo] Invoice creation failed:', {
        timestamp: new Date().toISOString(),
        user_id: params.userId,
        plan: params.plan,
        amount: params.amountHuf,
        partner_id: partnerId,
        email: params.customerEmail,
        status: invoiceRes.status,
        status_text: invoiceRes.statusText,
        error_detail: errorText,
      });
      return { ok: false, error: `Invoice creation failed (${invoiceRes.status} ${invoiceRes.statusText}): ${errorText.slice(0, 500)}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Billingo] Unexpected error:', {
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      plan: params.plan,
      amount: params.amountHuf,
      email: params.customerEmail,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, error: `Unexpected Billingo error: ${message.slice(0, 500)}` };
  }
}

// ─── Plan amount mapping ───
const PLAN_AMOUNTS: Record<string, number> = {
  monthly: 4990,
  yearly: 49900,
  lifetime: 149900,
};

const ADS_PLAN_AMOUNTS: Record<string, number> = {
  monthly: 4990,
  yearly: 49900,
};

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const sigHeader = req.headers.get('stripe-signature') || '';

  if (!(await verifyStripeSignature(body, sigHeader))) {
    console.error('[Webhook] Invalid Stripe signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let event: {
    id?: string;
    type: string;
    data: {
      object: Record<string, unknown>;
    };
  };

  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const obj = event.data.object;
  console.log('[Webhook] Event received:', {
    type: event.type,
    environment: STRIPE_ENV,
    session_id: obj.id,
  });

  try {
    switch (event.type) {
      // ── Checkout completed (both subscription and one-time) ──
      case 'checkout.session.completed': {
        const userId = (obj.client_reference_id || (obj.metadata as Record<string, string>)?.user_id) as string;
        const customerEmail = getNestedEmail(obj);
        const stripeCustomerId = obj.customer as string || '';
        const mode = obj.mode as string;
        const metadata = readMetadata(obj.metadata);
        const plan = metadata.plan || 'monthly';
        const paymentStatus = obj.payment_status as string;
        const stripeEventId = getStripeEventId(event, obj);

        console.log('[Webhook] Checkout completed:', {
          user_id: userId,
          mode,
          plan,
          payment_status: paymentStatus,
          customer_id: stripeCustomerId,
          email: customerEmail,
        });

        if (!userId) {
          console.error('[Webhook] CRITICAL: No user_id in session', {
            session_id: obj.id,
            metadata,
            client_reference_id: obj.client_reference_id,
          });
          break;
        }

        // CRITICAL: Only process successful payments
        // checkout.session.completed fires on form submission, NOT on payment success
        // payment_status can be: 'paid', 'unpaid', or 'no_payment_required'
        if (paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
          console.log('[Webhook] Checkout completed but payment not successful:', {
            user_id: userId,
            payment_status: paymentStatus,
            session_id: obj.id,
            plan,
            mode,
          });
          break;
        }

        // ── Ads module subscription ──
        const isAdsModule = metadata.module === 'ads';
        if (isAdsModule) {
          const stripeSubId = obj.subscription as string || null;
          const adsPayload = {
            ads_status: 'active',
            ads_plan: plan,
            ads_stripe_subscription_id: stripeSubId,
            ads_current_period_start: new Date().toISOString(),
            ads_current_period_end: plan === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            stripe_customer_id: stripeCustomerId,
          };
          const { data: existing } = await supabase.from('subscriptions')
            .select('id').eq('user_id', userId).maybeSingle();
          if (existing) {
            const { error: updErr } = await supabase.from('subscriptions')
              .update(adsPayload).eq('user_id', userId);
            if (updErr) {
              console.error('[Webhook] CRITICAL: Failed to activate Ads subscription:', {
                user_id: userId, session_id: obj.id, error: updErr,
              });
              throw new Error(`Failed to update Ads subscription: ${updErr.message}`);
            }
            console.log('[Webhook] Ads subscription activated:', { user_id: userId, plan });
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...adsPayload });
            if (insErr) {
              console.error('[Webhook] CRITICAL: Failed to create Ads subscription:', {
                user_id: userId, session_id: obj.id, error: insErr,
              });
              throw new Error(`Failed to insert Ads subscription: ${insErr.message}`);
            }
            console.log('[Webhook] Ads subscription created:', { user_id: userId, plan });
          }

          // Create Billingo invoice for Ads module
          const adsBillingEvent = await beginBillingEvent({
            stripeEventId,
            stripeEventType: event.type,
            stripeCheckoutSessionId: readString(obj.id),
            stripeSubscriptionId: stripeSubId,
            userId,
            module: 'ads',
            plan,
            customerEmail,
          });
          if (!adsBillingEvent.shouldProcess) break;

          const adsBillingoResult = await createBillingoInvoice({
            customerEmail,
            customerName: getNestedCustomerName(obj),
            customerAddress: getNestedCustomerAddress(obj),
            customerTaxCode: getNestedCustomerTaxCode(obj),
            plan: `ads_${plan}`,
            amountHuf: ADS_PLAN_AMOUNTS[plan] || 0,
            userId,
            stripeReference: readString(obj.id),
          });
          if (adsBillingoResult.ok && userId) {
            await supabase.from('subscriptions').update({
              billingo_invoice_id: adsBillingoResult.invoiceId.toString(),
              billingo_partner_id: adsBillingoResult.partnerId,
            }).eq('user_id', userId);
            await finishBillingEvent(stripeEventId, {
              status: 'processed',
              billingoInvoiceId: adsBillingoResult.invoiceId,
              billingoPartnerId: adsBillingoResult.partnerId,
              billingoEmailSent: adsBillingoResult.emailSent,
              billingoEmailError: adsBillingoResult.emailError,
            });
          } else {
            await finishBillingEvent(stripeEventId, {
              status: 'failed',
              error: adsBillingoResult.ok ? 'Billingo invoice creation failed for Ads checkout' : adsBillingoResult.error,
            });
          }
          break;
        }

        if (mode === 'payment') {
          // One-time purchase (lifetime)
          const subPayload = {
            status: 'active',
            plan: 'lifetime',
            current_period_start: new Date().toISOString(),
            current_period_end: null,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: null,
          };
          const { data: existing } = await supabase.from('subscriptions')
            .select('id').eq('user_id', userId).maybeSingle();
          if (existing) {
            const { error: updErr } = await supabase.from('subscriptions')
              .update(subPayload).eq('user_id', userId);
            if (updErr) {
              console.error('[Webhook] CRITICAL: Failed to activate lifetime subscription:', {
                user_id: userId,
                session_id: obj.id,
                error: updErr,
              });
              throw new Error(`Failed to update lifetime subscription: ${updErr.message}`);
            }
            console.log('[Webhook] Lifetime subscription activated (updated):', { user_id: userId });
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...subPayload });
            if (insErr) {
              console.error('[Webhook] CRITICAL: Failed to create lifetime subscription:', {
                user_id: userId,
                session_id: obj.id,
                error: insErr,
              });
              throw new Error(`Failed to insert lifetime subscription: ${insErr.message}`);
            }
            console.log('[Webhook] Lifetime subscription activated (created):', { user_id: userId });
          }

          // Cancel any dangling Stripe subscriptions for this customer
          // to prevent subscription events from overwriting the lifetime plan
          if (stripeCustomerId) {
            try {
              const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
              const listRes = await fetch(
                `https://api.stripe.com/v1/subscriptions?customer=${stripeCustomerId}&status=all`,
                {
                  headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                }
              );
              if (listRes.ok) {
                const listData = await listRes.json();
                for (const sub of (listData.data || [])) {
                  if (sub.status === 'incomplete' || sub.status === 'active' || sub.status === 'past_due') {
                    const cancelRes = await fetch(
                      `https://api.stripe.com/v1/subscriptions/${sub.id}`,
                      {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                      }
                    );
                    console.log('[Webhook] Cancelled dangling subscription after lifetime purchase:', {
                      subscription_id: sub.id,
                      status: sub.status,
                      user_id: userId,
                      cancel_success: cancelRes.ok,
                    });
                  }
                }
              }
            } catch (cleanupErr) {
              console.error('[Webhook] Failed to cleanup old subscriptions:', {
                user_id: userId,
                error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
              });
            }
          }
        } else if (mode === 'subscription') {
          // Subscription purchase
          const stripeSubId = obj.subscription as string || null;
          const subPayload = {
            status: 'active',
            plan,
            current_period_start: new Date().toISOString(),
            current_period_end: plan === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubId,
          };
          const { data: existing } = await supabase.from('subscriptions')
            .select('id').eq('user_id', userId).maybeSingle();
          if (existing) {
            const { error: updErr } = await supabase.from('subscriptions')
              .update(subPayload).eq('user_id', userId);
            if (updErr) {
              console.error('[Webhook] CRITICAL: Subscription update failed:', { user_id: userId, plan, error: updErr });
              throw new Error(`Failed to update subscription: ${updErr.message}`);
            } else {
              console.log('[Webhook] Subscription activated:', { user_id: userId, plan, subscription_id: stripeSubId });
            }
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...subPayload });
            if (insErr) {
              console.error('[Webhook] CRITICAL: Subscription insert failed:', { user_id: userId, plan, error: insErr });
              throw new Error(`Failed to insert subscription: ${insErr.message}`);
            } else {
              console.log('[Webhook] Subscription created:', { user_id: userId, plan, subscription_id: stripeSubId });
            }
          }
        }

        const billingEvent = await beginBillingEvent({
          stripeEventId,
          stripeEventType: event.type,
          stripeCheckoutSessionId: readString(obj.id),
          stripeSubscriptionId: mode === 'subscription' ? readString(obj.subscription) : null,
          userId,
          module: 'klient',
          plan,
          customerEmail,
        });
        if (!billingEvent.shouldProcess) break;

        // Create Billingo invoice
        console.log('[Webhook] Creating Billingo invoice:', {
          timestamp: new Date().toISOString(),
          user_id: userId,
          plan,
          amount: PLAN_AMOUNTS[plan],
          email: customerEmail,
        });
        const billingoResult = await createBillingoInvoice({
          customerEmail,
          customerName: getNestedCustomerName(obj),
          customerAddress: getNestedCustomerAddress(obj),
          customerTaxCode: getNestedCustomerTaxCode(obj),
          plan,
          amountHuf: PLAN_AMOUNTS[plan] || 0,
          userId,
          stripeReference: readString(obj.id),
        });

        // Store Billingo IDs if invoice was created successfully
        if (billingoResult.ok && userId) {
          const { error: billingoUpdateErr } = await supabase
            .from('subscriptions')
            .update({
              billingo_invoice_id: billingoResult.invoiceId.toString(),
              billingo_partner_id: billingoResult.partnerId,
            })
            .eq('user_id', userId);

          if (billingoUpdateErr) {
            console.error('[Webhook] Failed to store Billingo IDs:', {
              user_id: userId,
              invoice_id: billingoResult.invoiceId,
              partner_id: billingoResult.partnerId,
              error: billingoUpdateErr,
            });
          } else {
            console.log('[Webhook] Billingo IDs stored successfully:', {
              user_id: userId,
              invoice_id: billingoResult.invoiceId,
              partner_id: billingoResult.partnerId,
            });
          }

          // Send Resend welcome email
          const displayName = getCustomerDisplayName(customerEmail, getNestedCustomerName(obj));
          const resendResult = await sendWelcomeResend({ plan, customerEmail, displayName, userId, eventType: event.type });

          await finishBillingEvent(stripeEventId, {
            status: 'processed',
            billingoInvoiceId: billingoResult.invoiceId,
            billingoPartnerId: billingoResult.partnerId,
            billingoEmailSent: billingoResult.emailSent,
            billingoEmailError: billingoResult.emailError,
            resendEmailId: resendResult.emailId,
            resendEmailSent: resendResult.sent,
            resendEmailError: resendResult.error,
          });
        } else {
          // Billingo failed — still try to send welcome email
          const displayName = getCustomerDisplayName(customerEmail, getNestedCustomerName(obj));
          const resendResult = await sendWelcomeResend({ plan, customerEmail, displayName, userId, eventType: event.type });
          await finishBillingEvent(stripeEventId, {
            status: 'failed',
            error: billingoResult.ok ? 'Billingo invoice creation failed for checkout' : billingoResult.error,
            resendEmailId: resendResult.emailId,
            resendEmailSent: resendResult.sent,
            resendEmailError: resendResult.error,
          });
        }

        break;
      }

      // ── Subscription created or updated ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const metadata = readMetadata(obj.metadata);
        const userId = metadata.user_id;
        const status = obj.status as string;
        const stripeCustomerId = obj.customer as string || '';
        const stripeSubId = obj.id as string || '';

        console.log('[Webhook] Subscription event:', {
          event: event.type,
          user_id: userId,
          status,
          subscription_id: stripeSubId,
        });

        if (!userId) {
          console.error('[Webhook] CRITICAL: No user_id in subscription metadata', {
            subscription_id: stripeSubId,
            customer_id: stripeCustomerId,
            metadata,
          });
          break;
        }

        // Guard: never overwrite a lifetime plan with subscription events
        const { data: currentSub } = await supabase.from('subscriptions')
          .select('plan').eq('user_id', userId).maybeSingle();
        if (currentSub?.plan === 'lifetime') {
          console.log('[Webhook] Skipping subscription event — user has lifetime plan:', {
            user_id: userId,
            subscription_id: stripeSubId,
            incoming_status: status,
          });
          break;
        }

        // Skip incomplete subscriptions — payment hasn't succeeded yet
        if (status === 'incomplete' || status === 'incomplete_expired') {
          console.log('[Webhook] Skipping incomplete subscription:', {
            user_id: userId,
            subscription_id: stripeSubId,
            status,
          });
          break;
        }

        // Map Stripe status to our status
        const cancelAtPeriodEnd = !!(obj.cancel_at_period_end);
        let appStatus: string;
        if (cancelAtPeriodEnd) {
          appStatus = 'cancelled';
        } else if (status === 'active' || status === 'trialing') {
          appStatus = 'active';
        } else if (status === 'past_due') {
          appStatus = 'past_due';
        } else if (status === 'canceled' || status === 'unpaid') {
          appStatus = 'expired';
        } else {
          // Unknown status — log and skip rather than defaulting to active
          console.warn('[Webhook] Unknown Stripe subscription status, skipping:', {
            user_id: userId,
            subscription_id: stripeSubId,
            status,
          });
          break;
        }

        // Determine plan from metadata or interval
        let plan = metadata.plan || 'monthly';
        const items = obj.items as { data?: Array<{ price?: { recurring?: { interval?: string } } }> } | undefined;
        if (items?.data?.[0]?.price?.recurring?.interval === 'year') {
          plan = 'yearly';
        }

        const periodStart = obj.current_period_start
          ? new Date((obj.current_period_start as number) * 1000).toISOString()
          : new Date().toISOString();
        const periodEnd = obj.current_period_end
          ? new Date((obj.current_period_end as number) * 1000).toISOString()
          : null;

        // Route to Ads module columns if metadata says so
        const isAdsSub = metadata.module === 'ads';
        if (isAdsSub) {
          const { error: adsUpdateErr } = await supabase.from('subscriptions').update({
            ads_status: appStatus,
            ads_plan: plan,
            ads_current_period_start: periodStart,
            ads_current_period_end: periodEnd,
            ads_stripe_subscription_id: stripeSubId,
            stripe_customer_id: stripeCustomerId,
          }).eq('user_id', userId);

          if (adsUpdateErr) {
            console.error('[Webhook] Ads subscription sync failed:', { user_id: userId, error: adsUpdateErr });
          } else {
            console.log('[Webhook] Ads subscription synced:', { user_id: userId, status: appStatus, plan });
          }
          break;
        }

        const { error: updateErr } = await supabase.from('subscriptions').update({
          status: appStatus,
          plan,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubId,
        }).eq('user_id', userId);

        if (updateErr) {
          console.error('[Webhook] Subscription sync failed:', { user_id: userId, error: updateErr });
        } else {
          console.log('[Webhook] Subscription synced:', { user_id: userId, status: appStatus, plan });
        }

        break;
      }

      // ── Recurring subscription payment succeeded ──
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const stripeEventId = getStripeEventId(event, obj);
        const stripeInvoiceId = readString(obj.id);
        const subscriptionId = readString(obj.subscription);
        const billingReason = readString(obj.billing_reason);

        console.log('[Webhook] Invoice payment succeeded:', {
          event: event.type,
          invoice_id: stripeInvoiceId,
          subscription_id: subscriptionId,
          billing_reason: billingReason,
        });

        if (billingReason !== 'subscription_cycle') {
          console.log('[Webhook] Skipping non-renewal invoice payment for Billingo:', {
            invoice_id: stripeInvoiceId,
            billing_reason: billingReason,
          });
          break;
        }

        if (!subscriptionId) {
          console.error('[Webhook] No subscription_id in paid invoice');
          break;
        }

        const lookup = await findSubscriptionByStripeSubscriptionId(subscriptionId);
        if (!lookup) break;

        const plan = getPlanFromStripeInvoice(obj, lookup.plan);
        const amountHuf = getStripeInvoiceAmountHuf(obj) || (
          lookup.module === 'ads' ? ADS_PLAN_AMOUNTS[plan] || 0 : PLAN_AMOUNTS[plan] || 0
        );
        const customerEmail = getNestedEmail(obj) || await getAuthUserEmail(lookup.userId);

        if (!amountHuf) {
          console.error('[Webhook] Paid invoice has no billable amount, skipping Billingo:', {
            invoice_id: stripeInvoiceId,
            subscription_id: subscriptionId,
            user_id: lookup.userId,
          });
          break;
        }

        const billingEvent = await beginBillingEvent({
          stripeEventId,
          stripeEventType: event.type,
          stripeInvoiceId,
          stripeSubscriptionId: subscriptionId,
          userId: lookup.userId,
          module: lookup.module,
          plan,
          customerEmail,
        });
        if (!billingEvent.shouldProcess) break;

        const billingoPlan = lookup.module === 'ads' ? `ads_${plan}` : plan;
        const billingoResult = await createBillingoInvoice({
          customerEmail,
          customerName: getNestedCustomerName(obj),
          customerAddress: getNestedCustomerAddress(obj),
          customerTaxCode: getNestedCustomerTaxCode(obj),
          plan: billingoPlan,
          amountHuf,
          userId: lookup.userId,
          stripeReference: stripeInvoiceId,
        });

        // Send yearly renewal email (only for klient module yearly plan)
        let renewalResend: ResendResult = { sent: false };
        if (lookup.module === 'klient' && plan === 'yearly') {
          const displayName = getCustomerDisplayName(customerEmail);
          renewalResend = await sendResendEmail({
            to: customerEmail,
            subject: 'Éves Klient előfizetésed megújult',
            html: renewalEmail(displayName, planAmountHu('yearly')),
            userId: lookup.userId,
            eventType: event.type,
          });
        }

        if (billingoResult.ok) {
          const { error: billingoUpdateErr } = await supabase
            .from('subscriptions')
            .update({
              billingo_invoice_id: billingoResult.invoiceId.toString(),
              billingo_partner_id: billingoResult.partnerId,
            })
            .eq('user_id', lookup.userId);

          if (billingoUpdateErr) {
            console.error('[Webhook] Failed to store renewal Billingo IDs:', {
              user_id: lookup.userId,
              invoice_id: billingoResult.invoiceId,
              partner_id: billingoResult.partnerId,
              error: billingoUpdateErr,
            });
          }

          await finishBillingEvent(stripeEventId, {
            status: 'processed',
            billingoInvoiceId: billingoResult.invoiceId,
            billingoPartnerId: billingoResult.partnerId,
            billingoEmailSent: billingoResult.emailSent,
            billingoEmailError: billingoResult.emailError,
            resendEmailId: renewalResend.emailId,
            resendEmailSent: renewalResend.sent,
            resendEmailError: renewalResend.error,
          });
        } else {
          await finishBillingEvent(stripeEventId, {
            status: 'failed',
            error: billingoResult.error,
            resendEmailId: renewalResend.emailId,
            resendEmailSent: renewalResend.sent,
            resendEmailError: renewalResend.error,
          });
        }

        break;
      }

      // ── Subscription deleted (cancelled + period ended) ──
      case 'customer.subscription.deleted': {
        const metadata = readMetadata(obj.metadata);
        const userId = metadata.user_id;

        console.log('[Webhook] Subscription deleted:', {
          user_id: userId,
          subscription_id: obj.id,
        });

        if (!userId) {
          console.error('[Webhook] CRITICAL: No user_id in subscription metadata', {
            subscription_id: obj.id,
            metadata,
          });
          break;
        }

        // Guard: never expire a lifetime plan due to a subscription deletion event
        const { data: currentSubDel } = await supabase.from('subscriptions')
          .select('plan, ads_stripe_subscription_id').eq('user_id', userId).maybeSingle();

        // Check if this is an Ads module subscription deletion
        const isAdsSubDel = metadata.module === 'ads' || currentSubDel?.ads_stripe_subscription_id === (obj.id as string);
        if (isAdsSubDel) {
          const { error: adsDelErr } = await supabase.from('subscriptions').update({
            ads_status: 'expired',
          }).eq('user_id', userId);
          if (adsDelErr) {
            console.error('[Webhook] Ads subscription expiration failed:', { user_id: userId, error: adsDelErr });
          } else {
            console.log('[Webhook] Ads subscription expired:', { user_id: userId });
          }
          break;
        }

        if (currentSubDel?.plan === 'lifetime') {
          console.log('[Webhook] Skipping subscription.deleted — user has lifetime plan:', {
            user_id: userId,
            subscription_id: obj.id,
          });
          break;
        }

        const { error: deleteErr } = await supabase.from('subscriptions').update({
          status: 'expired',
        }).eq('user_id', userId);

        if (deleteErr) {
          console.error('[Webhook] Subscription expiration failed:', { user_id: userId, error: deleteErr });
        } else {
          console.log('[Webhook] Subscription expired:', { user_id: userId });
        }

        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const subscriptionId = obj.subscription as string;
        const invoiceId = obj.id as string;
        const attemptCount = obj.attempt_count as number;

        console.log('[Webhook] Payment failed:', {
          subscription_id: subscriptionId,
          invoice_id: invoiceId,
          attempt_count: attemptCount,
        });

        if (!subscriptionId) {
          console.error('[Webhook] No subscription_id in failed invoice');
          break;
        }

        // Look up user by stripe_subscription_id (main or Ads)
        let sub = null;
        let lookupErr = null;
        let isAdsPaymentFailed = false;

        // Try main subscription first
        const { data: mainSub, error: mainLookupErr } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (mainSub) {
          sub = mainSub;
        } else {
          // Try Ads subscription
          const { data: adsSub, error: adsLookupErr } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('ads_stripe_subscription_id', subscriptionId)
            .maybeSingle();
          if (adsSub) {
            sub = adsSub;
            isAdsPaymentFailed = true;
          } else {
            lookupErr = mainLookupErr || adsLookupErr;
          }
        }

        if (lookupErr || !sub) {
          console.error('[Webhook] Failed to lookup subscription:', { subscription_id: subscriptionId, error: lookupErr });
          break;
        }

        if (!sub?.user_id) {
          console.error('[Webhook] Subscription not found in database:', { subscription_id: subscriptionId });
          break;
        }

        // Update subscription status to past_due
        const updatePayload = isAdsPaymentFailed
          ? { ads_status: 'past_due' }
          : { status: 'past_due' };
        const { error: updateErr } = await supabase.from('subscriptions')
          .update(updatePayload).eq('user_id', sub.user_id);

        if (updateErr) {
          console.error('[Webhook] Failed to mark subscription past_due:', { user_id: sub.user_id, error: updateErr });
        } else {
          console.log('[Webhook] Subscription marked past_due:', { user_id: sub.user_id, attempt_count: attemptCount });
        }

        // Send dunning email (idempotent: one per stripe_invoice_id, klient module only)
        if (!isAdsPaymentFailed && invoiceId && BILLING_PORTAL_TOKEN_SECRET) {
          const stripeEventId = getStripeEventId(event, obj);
          const customerEmail = getNestedEmail(obj) || await getAuthUserEmail(sub.user_id);

          const dunningEvent = await beginBillingEvent({
            stripeEventId,
            stripeEventType: event.type,
            stripeInvoiceId: invoiceId,
            stripeSubscriptionId: subscriptionId,
            userId: sub.user_id,
            module: 'klient',
            customerEmail,
          });

          if (dunningEvent.shouldProcess) {
            if (!customerEmail) {
              await finishBillingEvent(stripeEventId, {
                status: 'skipped',
                error: 'No customer email available for dunning',
              });
            } else {
              // Look up stripe_customer_id for the HMAC token
              const { data: subData } = await supabase
                .from('subscriptions')
                .select('stripe_customer_id')
                .eq('user_id', sub.user_id)
                .maybeSingle();

              const stripeCustomerId = (subData?.stripe_customer_id as string) || '';
              const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
              const hmacToken = stripeCustomerId
                ? await signBillingPortalToken(sub.user_id, stripeCustomerId, expiresAt, BILLING_PORTAL_TOKEN_SECRET)
                : '';
              const portalLink = hmacToken
                ? `https://klient.work/billing?token=${encodeURIComponent(hmacToken)}`
                : 'https://klient.work';

              const displayName = getCustomerDisplayName(customerEmail, getNestedCustomerName(obj));
              const dunningResend = await sendResendEmail({
                to: customerEmail,
                subject: 'Fizetési hiba — Klient előfizetés',
                html: dunningEmail(displayName, portalLink),
                userId: sub.user_id,
                eventType: event.type,
              });

              await finishBillingEvent(stripeEventId, {
                status: dunningResend.sent ? 'processed' : 'failed',
                resendEmailId: dunningResend.emailId,
                resendEmailSent: dunningResend.sent,
                resendEmailError: dunningResend.error,
                error: dunningResend.sent ? undefined : `Dunning email not sent: ${dunningResend.error}`,
              });
            }
          }
        }

        break;
      }

      // ── Payment Intent Succeeded (backup for one-time lifetime payments) ──
      case 'payment_intent.succeeded': {
        const metadata = obj.metadata as Record<string, string> || {};
        const userId = metadata.user_id;
        const plan = metadata.plan;

        // Only handle if this is a lifetime purchase (one-time payment)
        if (!userId || plan !== 'lifetime') {
          console.log('[Webhook] payment_intent.succeeded (not lifetime, skipping):', {
            user_id: userId,
            plan,
            payment_intent_id: obj.id,
          });
          break;
        }

        console.log('[Webhook] Processing lifetime payment_intent.succeeded:', {
          user_id: userId,
          payment_intent_id: obj.id,
        });

        // Check if already activated (via checkout.session.completed)
        const { data: currentSub } = await supabase.from('subscriptions')
          .select('status, plan').eq('user_id', userId).maybeSingle();

        if (currentSub?.plan === 'lifetime' && currentSub?.status === 'active') {
          console.log('[Webhook] Lifetime already activated, skipping payment_intent:', {
            user_id: userId,
            payment_intent_id: obj.id,
          });
          break;
        }

        // Activate lifetime subscription as backup
        const subPayload = {
          status: 'active',
          plan: 'lifetime',
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          stripe_customer_id: obj.customer as string || '',
        };

        if (currentSub) {
          const { error: updErr } = await supabase.from('subscriptions')
            .update(subPayload).eq('user_id', userId);
          if (updErr) {
            console.error('[Webhook] CRITICAL: Failed to activate lifetime via payment_intent (update):', {
              user_id: userId,
              payment_intent_id: obj.id,
              error: updErr,
            });
            throw new Error(`Failed to update lifetime via payment_intent: ${updErr.message}`);
          }
          console.log('[Webhook] Lifetime activated via payment_intent (updated):', { user_id: userId });
        } else {
          const { error: insErr } = await supabase.from('subscriptions')
            .insert({ user_id: userId, ...subPayload });
          if (insErr) {
            console.error('[Webhook] CRITICAL: Failed to activate lifetime via payment_intent (insert):', {
              user_id: userId,
              payment_intent_id: obj.id,
              error: insErr,
            });
            throw new Error(`Failed to insert lifetime via payment_intent: ${insErr.message}`);
          }
          console.log('[Webhook] Lifetime activated via payment_intent (created):', { user_id: userId });
        }

        break;
      }

      default:
        console.log('[Webhook] Unhandled event type:', { type: event.type, id: obj.id });
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      event_type: event.type,
      event_id: obj.id,
    });
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});