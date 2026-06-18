-- ============================================================
-- KLIENT - Resend email tracking fields on billing events
-- Date: 2026-05-20
-- Purpose: Log Klient-branded transactional email delivery results
-- ============================================================

ALTER TABLE public.subscription_billing_events
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS resend_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resend_email_error TEXT;

COMMENT ON COLUMN public.subscription_billing_events.resend_email_id IS 'Resend email ID returned by the API on successful delivery.';
COMMENT ON COLUMN public.subscription_billing_events.resend_email_sent IS 'True when Resend successfully sent the Klient-branded transactional email.';
COMMENT ON COLUMN public.subscription_billing_events.resend_email_error IS 'Error message from Resend if sending failed.';
