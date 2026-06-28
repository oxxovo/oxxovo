-- OXXOVO -- watch_as_home platform flag (2026-06-28)
-- ===========================================================================
-- Run in Supabase SQL Editor.
--
-- Adds the watch_as_home flag to platform_config (default 'false'). When 'true',
-- the root (/) shows the Watch surface; when 'false' (launch 7/25), the root
-- shows the marketing landing. TK flips it to 'true' manually (admin toggle or
-- the UPDATE below) once Season 0 videos have accumulated.
--
-- Idempotent: ON CONFLICT DO NOTHING (won't clobber a value already set).
-- ===========================================================================

INSERT INTO public.platform_config (key, value)
VALUES ('watch_as_home', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── Verification ──
SELECT key, value FROM public.platform_config WHERE key = 'watch_as_home';

-- ── To turn Watch-as-home ON later (instead of the admin toggle) ──
-- UPDATE public.platform_config SET value = 'true' WHERE key = 'watch_as_home';
-- ── To turn it back OFF ──
-- UPDATE public.platform_config SET value = 'false' WHERE key = 'watch_as_home';
