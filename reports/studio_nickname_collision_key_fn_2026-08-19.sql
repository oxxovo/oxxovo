-- ============================================================================
-- nickname_collision_key_sql() -- parity helper only (2026-08-19)
-- ============================================================================
-- Exposes the EXACT expression the unique index uses
-- (reports/studio_nickname_unique_2026-08-19.sql) as a callable function, so
-- scripts/verify-nickname-collision-key.mjs can cross-check it against
-- lib/nickname.ts's nicknameCollisionKey() on the same inputs -- TK
-- 2026-08-19: a comment alone does not keep two definitions of the same rule
-- in sync (배점 이중 진실, same day). Pure string function, no table access,
-- IMMUTABLE. Not used by any app code path -- verification only.
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.nickname_collision_key_sql(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(p_value, '[ ._-]', '', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.nickname_collision_key_sql(text) TO service_role;

COMMIT;

-- ============================================================================
-- Verification -- expect one row, value 'kira'
-- ============================================================================
SELECT public.nickname_collision_key_sql('K.i r_a') AS should_be_kira;
