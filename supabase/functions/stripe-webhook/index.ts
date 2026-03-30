import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BILLINGO_API_KEY = Deno.env.get('BILLINGO_API_KEY') || '';
const STRIPE_ENV = Deno.env.get('STRIPE_ENV') || 'test';
const BILLINGO_ENV = Deno.env.get('BILLINGO_ENV') || 'sandbox';

// Supabase client with service_role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Billingo API base URL selection ───
function getBillingoBaseUrl(): string {
  // NOTE: Sandbox URL should be verified with Billingo API documentation
  // Common patterns: api.sandbox.billingo.hu, sandbox.billingo.hu, etc.
  if (BILLINGO_ENV === 'production') {
    return 'https://api.billingo.hu/v3';
  }
  // Default to sandbox for safety
  return 'https://api.sandbox.billingo.hu/v3';
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
  plan: string;
  amountHuf: number;
  userId: string;
}): Promise<{ invoiceId: number; partnerId: number } | null> {
  if (!BILLINGO_API_KEY) {
    console.log('[Billingo] No API key configured, skipping invoice');
    return null;
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
            name: params.customerEmail,
            emails: [params.customerEmail],
            taxcode: '',
            address: {
              country_code: 'HU',
              post_code: '0000',
              city: 'N/A',
              address: 'N/A',
            },
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
          return null;
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
      return null;
    }

    const planNames: Record<string, string> = {
      monthly: 'Klient Havi előfizetés',
      yearly: 'Klient Éves előfizetés',
      lifetime: 'Klient Lifetime licenc',
    };

    // Create the invoice
    const invoiceRes = await fetch(`${billingoBaseUrl}/documents`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partner_id: partnerId,
        block_id: 314533,
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
            unit_price_type: 'gross',
            quantity: 1,
            unit: 'db',
            vat: '27%',
          },
        ],
      }),
    });

    if (invoiceRes.ok) {
      const invoice = await invoiceRes.json();
      console.log('[Billingo] Invoice created successfully:', {
        timestamp: new Date().toISOString(),
        user_id: params.userId,
        invoice_id: invoice.id,
        plan: params.plan,
        amount: params.amountHuf,
        partner_id: partnerId,
        email: params.customerEmail,
      });
      return { invoiceId: invoice.id, partnerId };
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
      return null;
    }
  } catch (err) {
    console.error('[Billingo] Unexpected error:', {
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      plan: params.plan,
      amount: params.amountHuf,
      email: params.customerEmail,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
}

// ─── Plan amount mapping ───
const PLAN_AMOUNTS: Record<string, number> = {
  monthly: 3990,
  yearly: 39900,
  lifetime: 119900,
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
        const customerEmail = obj.customer_email as string || '';
        const stripeCustomerId = obj.customer as string || '';
        const mode = obj.mode as string;
        const metadata = obj.metadata as Record<string, string> || {};
        const plan = metadata.plan || 'monthly';

        console.log('[Webhook] Checkout completed:', {
          user_id: userId,
          mode,
          plan,
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
            if (updErr) console.error('[Webhook] Update error:', updErr);
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...subPayload });
            if (insErr) console.error('[Webhook] Insert error:', insErr);
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
              console.error('[Webhook] Subscription update failed:', { user_id: userId, plan, error: updErr });
            } else {
              console.log('[Webhook] Subscription activated:', { user_id: userId, plan, subscription_id: stripeSubId });
            }
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...subPayload });
            if (insErr) {
              console.error('[Webhook] Subscription insert failed:', { user_id: userId, plan, error: insErr });
            } else {
              console.log('[Webhook] Subscription created:', { user_id: userId, plan, subscription_id: stripeSubId });
            }
          }
        }

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
          plan,
          amountHuf: PLAN_AMOUNTS[plan] || 0,
          userId,
        });

        // Store Billingo IDs if invoice was created successfully
        if (billingoResult && userId) {
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
        }

        break;
      }

      // ── Subscription created or updated ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const metadata = obj.metadata as Record<string, string> || {};
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

        // Map Stripe status to our status
        let appStatus: string;
        if (status === 'active' || status === 'trialing') {
          appStatus = 'active';
        } else if (status === 'past_due') {
          appStatus = 'past_due';
        } else if (status === 'canceled' || status === 'unpaid') {
          appStatus = 'expired';
        } else {
          appStatus = 'active';
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

      // ── Subscription deleted (cancelled + period ended) ──
      case 'customer.subscription.deleted': {
        const metadata = obj.metadata as Record<string, string> || {};
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

        // Look up user by stripe_subscription_id
        const { data: sub, error: lookupErr } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (lookupErr) {
          console.error('[Webhook] Failed to lookup subscription:', { subscription_id: subscriptionId, error: lookupErr });
          break;
        }

        if (sub?.user_id) {
          const { error: updateErr } = await supabase.from('subscriptions').update({
            status: 'past_due',
          }).eq('user_id', sub.user_id);

          if (updateErr) {
            console.error('[Webhook] Failed to mark subscription past_due:', { user_id: sub.user_id, error: updateErr });
          } else {
            console.log('[Webhook] Subscription marked past_due:', { user_id: sub.user_id, attempt_count: attemptCount });
          }
        } else {
          console.error('[Webhook] Subscription not found in database:', { subscription_id: subscriptionId });
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
