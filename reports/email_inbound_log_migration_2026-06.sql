-- ===========================================================================
-- email_inbound_log -- info@oxxovo.com inbound auto-responder ledger
-- ===========================================================================
-- The /api/email/inbound webhook (fed by the Cloudflare Email Worker) records
-- every inbound message it processes here. Purposes:
--   1. Dedup: message_id UNIQUE blocks double-processing on Cloudflare retries.
--   2. Loop / spam guard: per-sender daily count is read from this table.
--   3. Transparency: surfaced read-only in \admin\messages.
--
-- Service-role only: the webhook uses createSupabaseAdmin(); no anon /
-- authenticated access. RLS enabled with zero policies (service role bypasses).
--
-- ASCII only (no box chars) -- Supabase SQL Editor drops the first line of a
-- box-drawn block. Use === dividers only.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_inbound_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   text UNIQUE,                 -- RFC822 Message-ID; dedup key (nullable: some senders omit it)
  from_email   text NOT NULL,               -- normalized lowercase sender address
  to_email     text,                        -- which alias received it (info@oxxovo.com)
  subject      text,
  -- action: what the webhook decided to do with this message.
  --   replied   = KB v4 in-scope -> auto-reply sent via Resend
  --   escalated = out-of-scope / sensitive -> forwarded to ops, no auto-reply
  --   skipped   = loop guard / rate cap / spam -> ignored (see skip_reason)
  action       text NOT NULL CHECK (action IN ('replied', 'escalated', 'skipped')),
  skip_reason  text,                         -- set when action='skipped' (loop|rate_cap|self|bulk|no_body|...)
  reply_sent   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Recent-activity feed for the admin page.
CREATE INDEX IF NOT EXISTS email_inbound_log_created_idx
  ON public.email_inbound_log (created_at DESC);

-- Per-sender daily cap lookup: count rows for a sender since midnight.
CREATE INDEX IF NOT EXISTS email_inbound_log_sender_idx
  ON public.email_inbound_log (from_email, created_at DESC);

-- Lock down: service role bypasses RLS; no policies = no anon/authenticated access.
ALTER TABLE public.email_inbound_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_inbound_log FROM anon, authenticated;

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'email_inbound_log'
ORDER BY ordinal_position;
-- expect: id, message_id, from_email, to_email, subject, action, skip_reason,
--         reply_sent, created_at
