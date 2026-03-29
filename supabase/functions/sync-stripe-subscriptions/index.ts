import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_ENV = Deno.env.get('STRIPE_ENV') || 'test';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') || 'change-me-in-production';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase client with service_role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer: string;
  items: {
    data: Array<{
      price: {
        recurring?: {
          interval?: string;
        };
      };
    }>;
  };
}

async function fetchStripeSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.log('[Sync] Subscription not found in Stripe:', { subscription_id: subscriptionId });
        return null;
      }
      const error = await res.json();
      console.error('[Sync] Stripe API error:', { subscription_id: subscriptionId, error });
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Sync] Failed to fetch subscription:', {
      subscription_id: subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function mapStripeStatus(stripeStatus: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) {
    return 'cancelled';
  }

  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'expired';
    case 'incomplete':
      return 'trial'; // Treat incomplete as still in trial
    default:
      return 'active';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Simple auth: require a secret token
    const authHeader = req.headers.get('Authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== SYNC_SECRET) {
      console.error('[Sync] Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Sync] Starting subscription sync:', { environment: STRIPE_ENV });

    // Fetch all subscriptions from database that have a Stripe subscription ID
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .not('stripe_subscription_id', 'is', null);

    if (fetchError) {
      console.error('[Sync] Failed to fetch subscriptions:', { error: fetchError });
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Sync] Found subscriptions to sync:', { count: subscriptions?.length || 0 });

    const results: {
      user_id: string;
      local_status: string;
      stripe_status: string | null;
      updated: boolean;
      error?: string;
    }[] = [];

    for (const sub of subscriptions || []) {
      const result = {
        user_id: sub.user_id,
        local_status: sub.status,
        stripe_status: null as string | null,
        updated: false,
        error: undefined as string | undefined,
      };

      try {
        // Fetch Stripe subscription
        const stripeSub = await fetchStripeSubscription(sub.stripe_subscription_id);

        if (!stripeSub) {
          // Subscription doesn't exist in Stripe, mark as expired locally
          result.error = 'not_found_in_stripe';

          if (sub.status !== 'expired') {
            const { error: updateErr } = await supabase
              .from('subscriptions')
              .update({ status: 'expired' })
              .eq('user_id', sub.user_id);

            if (updateErr) {
              console.error('[Sync] Failed to expire missing subscription:', {
                user_id: sub.user_id,
                error: updateErr,
              });
              result.error = 'update_failed';
            } else {
              result.updated = true;
              console.log('[Sync] Expired missing subscription:', { user_id: sub.user_id });
            }
          }

          results.push(result);
          continue;
        }

        // Map Stripe status to app status
        const expectedStatus = mapStripeStatus(stripeSub.status, stripeSub.cancel_at_period_end);
        result.stripe_status = stripeSub.status;

        // Check if status needs updating
        if (sub.status !== expectedStatus) {
          const updatePayload: Record<string, unknown> = {
            status: expectedStatus,
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          };

          // Determine plan from interval
          const interval = stripeSub.items.data[0]?.price?.recurring?.interval;
          if (interval === 'year') {
            updatePayload.plan = 'yearly';
          } else if (interval === 'month') {
            updatePayload.plan = 'monthly';
          }

          const { error: updateErr } = await supabase
            .from('subscriptions')
            .update(updatePayload)
            .eq('user_id', sub.user_id);

          if (updateErr) {
            console.error('[Sync] Failed to update subscription:', {
              user_id: sub.user_id,
              error: updateErr,
            });
            result.error = 'update_failed';
          } else {
            result.updated = true;
            console.log('[Sync] Updated subscription:', {
              user_id: sub.user_id,
              from: sub.status,
              to: expectedStatus,
              stripe_status: stripeSub.status,
            });
          }
        } else {
          console.log('[Sync] Subscription already in sync:', {
            user_id: sub.user_id,
            status: sub.status,
          });
        }
      } catch (err) {
        console.error('[Sync] Error processing subscription:', {
          user_id: sub.user_id,
          error: err instanceof Error ? err.message : String(err),
        });
        result.error = 'processing_error';
      }

      results.push(result);
    }

    const summary = {
      total: results.length,
      updated: results.filter((r) => r.updated).length,
      errors: results.filter((r) => r.error).length,
      in_sync: results.filter((r) => !r.updated && !r.error).length,
    };

    console.log('[Sync] Sync completed:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      results,
      environment: STRIPE_ENV,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Sync] Unexpected error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
