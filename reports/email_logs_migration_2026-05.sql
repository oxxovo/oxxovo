-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO email_logs migration — Phase 5a
-- Run in Supabase SQL Editor (full file as one block).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Table
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.genesis_applications(id) ON DELETE SET NULL,
  season_id TEXT REFERENCES public.seasons(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ko', 'en')),
  subject TEXT NOT NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'queued', 'skipped')),
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX email_logs_application ON public.email_logs(application_id);
CREATE INDEX email_logs_template    ON public.email_logs(template_key);
CREATE INDEX email_logs_season      ON public.email_logs(season_id);
CREATE INDEX email_logs_sent_at     ON public.email_logs(sent_at DESC);

-- Partial unique — one 'sent' row per (application, template).
-- 'failed' / 'skipped' / 'queued' rows are NOT blocked by this index, so
-- retries and reminders still insert cleanly.
CREATE UNIQUE INDEX email_logs_dedup
  ON public.email_logs(application_id, template_key)
  WHERE status = 'sent';

-- 3. GRANT — PostgREST visibility (same pattern as profiles / seasons fix)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

-- 4. RLS — only admins can read/write through the user-context client.
--    (Service role bypasses RLS entirely for automated triggers / cron.)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_admin_all ON public.email_logs;

CREATE POLICY email_logs_admin_all ON public.email_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (run AFTER the COMMIT above)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Columns — expect 13 rows
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'email_logs'
ORDER BY ordinal_position;

-- 2) Indexes — expect 6 rows (PK + 4 plain + 1 partial unique)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'email_logs'
ORDER BY indexname;

-- 3) RLS policy — expect 1 row: email_logs_admin_all / ALL / {authenticated}
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'email_logs';

-- 4) GRANT — expect authenticated (4 privs) + service_role (ALL).
--    anon should NOT appear.
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'email_logs'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;
