import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleBillingPortalRequest, type BillingPortalDeps } from './handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const BILLING_PORTAL_TOKEN_SECRET = Deno.env.get('BILLING_PORTAL_TOKEN_SECRET') || '';
const RETURN_URL = 'https://klient.work/subscription';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const deps: BillingPortalDeps = {
  billingPortalTokenSecret: BILLING_PORTAL_TOKEN_SECRET,

  validateBearerJwt: async (authHeader) => {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
  },

  getStripeCustomerId: async (userId) => {
    const { data, error } = await serviceClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data?.stripe_customer_id) return null;
    return data.stripe_customer_id as string;
  },

  createStripePortalSession: async (stripeCustomerId) => {
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ customer: stripeCustomerId, return_url: RETURN_URL }),
    });
    if (!res.ok) {
      console.error('[create-billing-portal] Stripe portal session failed:', {
        status: res.status,
        body: await res.text(),
      });
      return null;
    }
    const data = await res.json();
    return (data.url as string) || null;
  },
};

Deno.serve((req) => handleBillingPortalRequest(req, deps));
