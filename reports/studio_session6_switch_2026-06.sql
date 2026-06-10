-- =========================================================================
-- OXXOVO Studio (Session 6) -- public exposure switch
-- Run in Supabase SQL Editor (full file as one block).
--
-- session6_enabled gates EVERY public studio surface. Default false: with it
-- off (or absent), /studio 404s, the /apply funnel falls back to the existing
-- flow, and all studio server actions refuse. Flip to true only when Session 6
-- launches. This lets feat/studio merge early without exposing anything.
--
-- ASCII-only. Idempotent (ON CONFLICT DO NOTHING keeps an existing value).
-- =========================================================================

BEGIN;

INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('session6_enabled', 'false', 'bool',
   'Master switch for all public Studio (Session 6) surfaces. false = hidden (/studio 404, no /apply funnel, actions refused).')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =========================================================================
-- Verification
-- =========================================================================
SELECT key, value, value_type FROM public.platform_config WHERE key = 'session6_enabled';
