import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Environment-based configuration
const STRIPE_ENV = Deno.env.get('STRIPE_ENV') || 'test';
const IS_PRODUCTION = STRIPE_ENV === 'production';

// Test mode price IDs (default)
const TEST_PRICE_IDS: Record<string, string> = {
  monthly: 'price_1TECUdArzcPFCRN0k4CyvdG1',
  yearly: 'price_1TECVpArzcPFCRN0L7oY3FPc',
  lifetime: 'price_1TECWhArzcPFCRN0GWGwf92H',
};

// Production price IDs (from environment variables)
const PROD_PRICE_IDS: Record<string, string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY_PROD') || '',
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY_PROD') || '',
  lifetime: Deno.env.get('STRIPE_PRICE_LIFETIME_PROD') || '',
};

// Select price IDs based on environment
const PRICE_IDS = IS_PRODUCTION ? PROD_PRICE_IDS : TEST_PRICE_IDS;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the user via Supabase JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nincs hitelesítés' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Érvénytelen token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { plan } = await req.json() as { plan: string };
    const priceId = PRICE_IDS[plan];

    // Validate plan and price ID
    if (!priceId) {
      console.error('[Checkout] Invalid plan requested:', { plan, user_id: user.id });
      return new Response(JSON.stringify({ error: 'Érvénytelen csomag' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Production mode validation: ensure production price IDs are configured
    if (IS_PRODUCTION && !priceId.startsWith('price_')) {
      console.error('[Checkout] Production price ID not configured:', { plan, STRIPE_ENV });
      return new Response(JSON.stringify({ error: 'Fizetési konfiguráció hiányzik' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isLifetime = plan === 'lifetime';

    // Environment-aware URLs
    const BASE_URL = Deno.env.get('APP_URL') || 'https://klient.work';
    const SUCCESS_URL = `${BASE_URL}/success`;
    const CANCEL_URL = `${BASE_URL}/cancel`;

    console.log('[Checkout] Creating session:', {
      user_id: user.id,
      plan,
      priceId,
      mode: isLifetime ? 'payment' : 'subscription',
      environment: STRIPE_ENV,
    });

    // Create Stripe Checkout Session via API
    const params = new URLSearchParams();
    params.append('mode', isLifetime ? 'payment' : 'subscription');
    params.append('success_url', SUCCESS_URL);
    params.append('cancel_url', CANCEL_URL);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('customer_email', user.email || '');
    params.append('client_reference_id', user.id);
    params.append('metadata[user_id]', user.id);
    params.append('metadata[plan]', plan);
    if (!isLifetime) {
      params.append('subscription_data[metadata][user_id]', user.id);
      params.append('subscription_data[metadata][plan]', plan);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error('[Checkout] Stripe API error:', {
        status: stripeRes.status,
        error: session,
        user_id: user.id,
        plan,
        priceId,
        environment: STRIPE_ENV,
      });
      return new Response(JSON.stringify({
        error: 'Stripe hiba',
        details: IS_PRODUCTION ? undefined : session.error?.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Checkout] Session created successfully:', {
      session_id: session.id,
      user_id: user.id,
      plan,
      amount: session.amount_total,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Checkout] Unexpected error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(JSON.stringify({ error: 'Szerverhiba' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
