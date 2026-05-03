-- ============================================================
-- KLIENT - Subscription billing event log
-- Date: 2026-05-03
-- Purpose: Idempotent Stripe webhook invoicing/email tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_event_type TEXT NOT NULL,
  stripe_invoice_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module TEXT NOT NULL DEFAULT 'klient'
    CHECK (module IN ('klient', 'ads')),
  plan TEXT,
  customer_email TEXT,
  billingo_invoice_id TEXT,
  billingo_partner_id INTEGER,
  billingo_email_sent BOOLEAN NOT NULL DEFAULT false,
  billingo_email_error TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'skipped', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_events_user_id
ON public.subscription_billing_events (user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_events_stripe_invoice_id
ON public.subscription_billing_events (stripe_invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscription_billing_events_stripe_invoice_id
ON public.subscription_billing_events (stripe_invoice_id)
WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_billing_events_stripe_subscription_id
ON public.subscription_billing_events (stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_events_status
ON public.subscription_billing_events (status);

CREATE OR REPLACE FUNCTION public.update_subscription_billing_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_subscription_billing_events_updated_at
ON public.subscription_billing_events;

CREATE TRIGGER set_subscription_billing_events_updated_at
  BEFORE UPDATE ON public.subscription_billing_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_billing_events_updated_at();

COMMENT ON TABLE public.subscription_billing_events IS 'Idempotency and delivery log for Stripe-triggered Billingo invoices and invoice emails.';
COMMENT ON COLUMN public.subscription_billing_events.billingo_email_sent IS 'True when Billingo /documents/{id}/send succeeded for the customer email.';