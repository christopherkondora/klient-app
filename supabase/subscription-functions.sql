-- ============================================================
-- KLIENT – LemonSqueezy Webhook Edge Function
-- Deploy via: supabase functions deploy lemonsqueezy-webhook
-- Set your webhook signing secret:
--   supabase secrets set LEMON_SQUEEZY_WEBHOOK_SECRET=your_secret
-- ============================================================
-- This is a reference. The actual Edge Function goes in
-- supabase/functions/lemonsqueezy-webhook/index.ts
-- ============================================================

-- Below is the SQL for a simple approach using a Postgres function
-- that can be called by a lightweight webhook proxy.
-- For production, use the Edge Function in the next file.

-- Activate subscription (called after successful payment)
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_ls_customer_id TEXT,
  p_ls_subscription_id TEXT
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
    lemon_squeezy_customer_id = p_ls_customer_id,
    lemon_squeezy_subscription_id = p_ls_subscription_id
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
