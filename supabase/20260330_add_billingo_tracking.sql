-- ============================================================
-- Migration: Add Billingo invoice and partner tracking
-- Date: 2026-03-30
-- Purpose: Store Billingo invoice_id and partner_id for reference
-- ============================================================

-- Add Billingo tracking columns to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS billingo_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS billingo_partner_id INTEGER;

-- Create index for faster lookup by Billingo invoice ID
CREATE INDEX IF NOT EXISTS idx_subscriptions_billingo_invoice_id
ON public.subscriptions (billingo_invoice_id);

-- Create index for faster lookup by Billingo partner ID
CREATE INDEX IF NOT EXISTS idx_subscriptions_billingo_partner_id
ON public.subscriptions (billingo_partner_id);

COMMENT ON COLUMN public.subscriptions.billingo_invoice_id IS 'Billingo invoice ID for tracking';
COMMENT ON COLUMN public.subscriptions.billingo_partner_id IS 'Billingo partner (customer) ID for tracking';
