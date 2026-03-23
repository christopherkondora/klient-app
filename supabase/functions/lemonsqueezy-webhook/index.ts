import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Supabase client with service_role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verify LemonSqueezy webhook signature using Web Crypto API (no external deps)
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === signature;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-signature') || '';

  // Verify webhook authenticity
  if (!(await verifySignature(body, signature))) {
    console.error('[Webhook] Invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let event: {
    meta: { event_name: string; custom_data?: { user_id?: string } };
    data: {
      id: string;
      attributes: {
        status: string;
        user_email?: string;
        customer_id?: number;
        variant_name?: string;
        renews_at?: string;
        ends_at?: string;
        created_at?: string;
        first_subscription_item?: { price_id?: number };
        order_number?: number;
        urls?: { customer_portal?: string };
      };
    };
  };

  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const eventName = event.meta.event_name;
  const userId = event.meta.custom_data?.user_id;
  const attrs = event.data.attributes;

  console.log(`[Webhook] Event: ${eventName}, User: ${userId}`);

  if (!userId) {
    console.error('[Webhook] No user_id in custom_data');
    return new Response('No user_id', { status: 400 });
  }

  try {
    switch (eventName) {
      case 'order_created': {
        // One-time purchase (lifetime plan)
        const variantName = (attrs.variant_name || '').toLowerCase();
        const isLifetime = variantName.includes('lifetime') || variantName.includes('élettartam');

        if (isLifetime) {
          await supabase.from('subscriptions').update({
            status: 'active',
            plan: 'lifetime',
            current_period_start: new Date().toISOString(),
            current_period_end: null, // lifetime = no end
            lemon_squeezy_customer_id: String(attrs.customer_id || ''),
          }).eq('user_id', userId);
        }
        break;
      }

      case 'subscription_created':
      case 'subscription_updated': {
        // Determine plan from variant name or renewal period
        const variantName = (attrs.variant_name || '').toLowerCase();
        let plan: 'monthly' | 'yearly' = 'monthly';
        if (variantName.includes('yearly') || variantName.includes('éves') || variantName.includes('annual')) {
          plan = 'yearly';
        }

        const status = attrs.status === 'active' ? 'active'
          : attrs.status === 'past_due' ? 'past_due'
          : attrs.status === 'cancelled' ? 'cancelled'
          : 'active';

        await supabase.from('subscriptions').update({
          status,
          plan,
          current_period_start: attrs.created_at || new Date().toISOString(),
          current_period_end: attrs.renews_at || attrs.ends_at || null,
          lemon_squeezy_customer_id: String(attrs.customer_id || ''),
          lemon_squeezy_subscription_id: String(event.data.id),
        }).eq('user_id', userId);
        break;
      }

      case 'subscription_cancelled': {
        // Cancelled — still active until period end
        await supabase.from('subscriptions').update({
          status: 'cancelled',
          current_period_end: attrs.ends_at || null,
        }).eq('user_id', userId);
        break;
      }

      case 'subscription_expired': {
        await supabase.from('subscriptions').update({
          status: 'expired',
        }).eq('user_id', userId);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${eventName}`);
    }
  } catch (err) {
    console.error(`[Webhook] DB error:`, err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
