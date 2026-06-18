import { verifyBillingPortalToken } from '../_shared/hmac-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface BillingPortalDeps {
  billingPortalTokenSecret: string;
  // Validates a Supabase Bearer JWT, returns userId on success, null on failure.
  validateBearerJwt: (authHeader: string) => Promise<string | null>;
  // Looks up the stripe_customer_id for a userId.
  getStripeCustomerId: (userId: string) => Promise<string | null>;
  // Creates a Stripe Customer Portal session and returns the redirect URL.
  createStripePortalSession: (stripeCustomerId: string) => Promise<string | null>;
}

export async function handleBillingPortalRequest(
  req: Request,
  deps: BillingPortalDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token');

  // ── Path A: HMAC token (email-initiated) ──
  if (tokenParam) {
    if (!deps.billingPortalTokenSecret) {
      return json({ error: 'Server configuration error' }, 500);
    }
    const payload = await verifyBillingPortalToken(tokenParam, deps.billingPortalTokenSecret);
    if (!payload) {
      return json({ error: 'A link lejárt vagy érvénytelen. Kérjük, nyisd meg a Klient appot.' }, 401);
    }
    const portalUrl = await deps.createStripePortalSession(payload.stripeCustomerId);
    if (!portalUrl) {
      return json({ error: 'Nem sikerült megnyitni a fizetési portált.' }, 500);
    }
    return json({ url: portalUrl });
  }

  // ── Path B: Bearer JWT (app-initiated) ──
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader) {
    return json({ error: 'Hiányzó autentikáció.' }, 400);
  }

  const userId = await deps.validateBearerJwt(authHeader);
  if (!userId) {
    return json({ error: 'Érvénytelen munkamenet.' }, 401);
  }

  const stripeCustomerId = await deps.getStripeCustomerId(userId);
  if (!stripeCustomerId) {
    return json({ error: 'Nem található Stripe ügyfélprofil.' }, 404);
  }

  const portalUrl = await deps.createStripePortalSession(stripeCustomerId);
  if (!portalUrl) {
    return json({ error: 'Nem sikerült megnyitni a fizetési portált.' }, 500);
  }

  return json({ url: portalUrl });
}
