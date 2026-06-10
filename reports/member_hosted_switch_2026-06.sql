-- =========================================================================
-- OXXOVO Member-Hosted Tournament -- public exposure switch
-- Run in Supabase SQL Editor (full file as one block).
--
-- member_hosted_enabled gates every public member-hosted surface. Default false:
-- with it off (or absent), /host 404s, the /admin/partners nav entry + page are
-- hidden, and partner emails (invitation + eligibility) are suppressed. Flip to
-- true only when the partner program launches. Lets PR #3 merge dark.
--
-- ASCII-only. Idempotent (ON CONFLICT DO NOTHING keeps an existing value).
-- =========================================================================

BEGIN;

INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('member_hosted_enabled', 'false', 'bool',
   'Master switch for all public Member-Hosted Tournament surfaces. false = hidden (/host 404, no /admin/partners entry, partner emails suppressed).')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =========================================================================
-- Verification
-- =========================================================================
SELECT key, value, value_type FROM public.platform_config WHERE key = 'member_hosted_enabled';
