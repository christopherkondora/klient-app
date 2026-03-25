import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BILLINGO_API_KEY = Deno.env.get('BILLINGO_API_KEY') || '';

// Supabase client with service_role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
}) {
  if (!BILLINGO_API_KEY) {
    console.log('[Billingo] No API key configured, skipping invoice');
    return;
  }

  try {
    // First, create or find the partner
    const partnerRes = await fetch('https://api.billingo.hu/v3/partners', {
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

    let partnerId: number;
    if (partnerRes.ok) {
      const partner = await partnerRes.json();
      partnerId = partner.id;
    } else {
      console.error('[Billingo] Partner creation failed:', await partnerRes.text());
      return;
    }

    const planNames: Record<string, string> = {
      monthly: 'Klient Havi előfizetés',
      yearly: 'Klient Éves előfizetés',
      lifetime: 'Klient Lifetime licenc',
    };

    // Create the invoice
    const invoiceRes = await fetch('https://api.billingo.hu/v3/documents', {
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
      console.log(`[Billingo] Invoice created: ${invoice.id}`);
    } else {
      console.error('[Billingo] Invoice creation failed:', await invoiceRes.text());
    }
  } catch (err) {
    console.error('[Billingo] Error:', err);
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
  console.log(`[Webhook] Event: ${event.type}`);

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

        if (!userId) {
          console.error('[Webhook] No user_id in session');
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
            if (updErr) console.error('[Webhook] Update error:', updErr);
          } else {
            const { error: insErr } = await supabase.from('subscriptions')
              .insert({ user_id: userId, ...subPayload });
            if (insErr) console.error('[Webhook] Insert error:', insErr);
          }
        }

        // Create Billingo invoice
        await createBillingoInvoice({
          customerEmail,
          plan,
          amountHuf: PLAN_AMOUNTS[plan] || 0,
        });

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

        if (!userId) {
          console.error('[Webhook] No user_id in subscription metadata');
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

        await supabase.from('subscriptions').update({
          status: appStatus,
          plan,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubId,
        }).eq('user_id', userId);

        break;
      }

      // ── Subscription deleted (cancelled + period ended) ──
      case 'customer.subscription.deleted': {
        const metadata = obj.metadata as Record<string, string> || {};
        const userId = metadata.user_id;

        if (!userId) {
          console.error('[Webhook] No user_id in subscription metadata');
          break;
        }

        await supabase.from('subscriptions').update({
          status: 'expired',
        }).eq('user_id', userId);

        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const subscriptionId = obj.subscription as string;
        if (!subscriptionId) break;

        // Look up user by stripe_subscription_id
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (sub?.user_id) {
          await supabase.from('subscriptions').update({
            status: 'past_due',
          }).eq('user_id', sub.user_id);
        }

        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
