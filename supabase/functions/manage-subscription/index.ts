import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripeRequest(path: string, method: string, body?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body?.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Stripe hiba');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    // Get user's subscription
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subError || !sub) {
      return new Response(JSON.stringify({ error: 'Nincs előfizetés' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client for DB writes (bypasses RLS)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action } = await req.json() as { action: 'cancel' | 'reactivate' };

    if (action === 'cancel') {
      if (!sub.stripe_subscription_id) {
        return new Response(JSON.stringify({ error: 'Nem lehet lemondani (nincs Stripe előfizetés)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cancel at period end (user keeps access until billing period ends)
      const params = new URLSearchParams();
      params.append('cancel_at_period_end', 'true');
      await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'POST', params);

      // Update local status (service role to bypass RLS)
      await adminClient
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ success: true, message: 'Előfizetés lemondva a jelenlegi időszak végéig' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reactivate') {
      if (!sub.stripe_subscription_id) {
        return new Response(JSON.stringify({ error: 'Nem lehet újraaktiválni' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Remove cancellation
      const params = new URLSearchParams();
      params.append('cancel_at_period_end', 'false');
      await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'POST', params);

      // Update local status (service role to bypass RLS)
      await adminClient
        .from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ success: true, message: 'Előfizetés újraaktiválva' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Érvénytelen művelet' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ManageSubscription] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || 'Szerverhiba' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
