-- ============================================================
-- KLIENT ADS – Ads module subscription columns on subscriptions table
-- Run this in the Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- Add Ads module subscription columns to existing subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS ads_status TEXT NOT NULL DEFAULT 'none'
    CHECK (ads_status IN ('none', 'active', 'cancelled', 'expired', 'past_due')),
  ADD COLUMN IF NOT EXISTS ads_plan TEXT
    CHECK (ads_plan IS NULL OR ads_plan IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS ads_stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS ads_current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ads_current_period_end TIMESTAMPTZ;

-- Index for quick Ads status lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_ads_status ON public.subscriptions (ads_status);

-- RPC function to expire Ads subscription (bypasses RLS)
CREATE OR REPLACE FUNCTION public.expire_ads_subscription(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET ads_status = 'expired', updated_at = NOW()
  WHERE user_id = p_user_id
    AND ads_status IN ('active', 'cancelled');
END;
$$;
