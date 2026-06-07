-- =========================================================================
-- OXXOVO Studio -- Stripe credit top-up (test mode)
-- Run in Supabase SQL Editor (full file as one block).
--
-- 1. credit_transactions.stripe_session_id -- idempotency for the webhook: one
--    'purchase' ledger row per Stripe Checkout session (a partial unique index
--    so non-purchase rows, which leave it NULL, are unaffected).
-- 2. platform_config keys:
--    studio_purchase_enabled  (bool, default false) -- gate the buy flow,
--      separate from session6_enabled.
--    studio_credit_pack_usd   (text) -- comma-separated USD pack amounts offered
--      (credits = amount / studio_credit_usd_value). No hardcoded packs.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- One purchase per Stripe session (NULL for all non-purchase rows -> ignored).
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_session_uniq
  ON public.credit_transactions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('studio_purchase_enabled', 'false', 'bool',
   'Gate for the Stripe credit top-up flow. false = buy disabled (separate from session6_enabled).'),
  ('studio_credit_pack_usd', '10,25,50', 'text',
   'Comma-separated USD amounts offered as credit packs. Credits = amount / studio_credit_usd_value.')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =========================================================================
-- Verification
-- =========================================================================
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='stripe_session_id';

SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='credit_transactions'
  AND indexname='credit_transactions_stripe_session_uniq';

SELECT key, value, value_type FROM public.platform_config
WHERE key IN ('studio_purchase_enabled','studio_credit_pack_usd') ORDER BY key;
