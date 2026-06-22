-- ===========================================================================
-- chat_logs -- OXXOVO Help Assistant out-of-scope question collection
-- ===========================================================================
-- The /api/chat route logs out-of-scope chatbot turns here (best-effort) so the
-- team can follow up via /admin/messages. Service-role only: both the route and
-- the admin page use the service-role client (createSupabaseAdmin), which
-- bypasses RLS -- anon/authenticated get no access. Logging is non-critical, so
-- the route no-ops if this table is absent; run this to enable the collection.
--
-- Style: ASCII only, idempotent. See [[feedback-sql-ascii-only]].
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip           text,
  question     text NOT NULL,
  reply        text,
  out_of_scope boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_logs_created_idx ON public.chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_logs_oos_idx ON public.chat_logs (out_of_scope, created_at DESC);

-- Lock down: service role bypasses RLS; no policies = no anon/authenticated access.
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_logs FROM anon, authenticated;

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chat_logs'
ORDER BY ordinal_position;
-- expect: id, ip, question, reply, out_of_scope, created_at
