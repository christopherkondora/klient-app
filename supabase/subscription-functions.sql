-- ============================================================
-- KLIENT – Stripe Webhook Edge Function helpers
-- Deploy via: supabase functions deploy stripe-webhook
-- Set your webhook signing secret:
--   supabase secrets set STRIPE_WEBHOOK_SECRET=your_secret
-- ============================================================

-- Activate subscription (called after successful Stripe payment)
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET
    status = 'active',
    plan = p_plan,
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id
  WHERE user_id = p_user_id;
END;
$$;

-- Cancel subscription (sets status to cancelled, still active until period end)
CREATE OR REPLACE FUNCTION public.cancel_subscription(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'cancelled'
  WHERE user_id = p_user_id;
END;
$$;

-- Expire subscription
CREATE OR REPLACE FUNCTION public.expire_subscription(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE user_id = p_user_id;
END;
$$;
