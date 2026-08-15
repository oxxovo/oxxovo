-- OXXOVO /admin/settings schema. Delivered to TK in chat, run via Supabase
-- SQL Editor. ASCII only -- Korean description_ko values are NOT set here;
-- they are seeded separately by a service-role script after this SQL runs,
-- so the SQL Editor never has to paste/round-trip non-ASCII text.

-- Part 1 (run 2026-08-15): history table + write RPC v1. Already executed.
-- CREATE TABLE IF NOT EXISTS public.platform_config_history (...);
-- see git history for the exact v1 statements; superseded by v2 below.

-- Part 2 (run 2026-08-15): Korean description column + write RPC v2.
-- Adds description_ko (nullable; English description stays canonical) and a
-- `field` column on the history table, so a description edit and a value
-- edit both go through the same function but stay distinguishable after.
-- Signature-compatible with v1 (same RETURNS TABLE, new param has a
-- DEFAULT) -- no DROP FUNCTION needed.

ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS description_ko TEXT;
ALTER TABLE public.platform_config_history ADD COLUMN IF NOT EXISTS field TEXT NOT NULL DEFAULT 'value';

CREATE OR REPLACE FUNCTION public.update_platform_config(
  p_key TEXT,
  p_new_value TEXT,
  p_admin_id UUID,
  p_admin_email TEXT,
  p_field TEXT DEFAULT 'value'
) RETURNS TABLE(old_value TEXT, value_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value_type TEXT;
  v_old_field_value TEXT;
BEGIN
  IF p_field NOT IN ('value', 'description_ko') THEN
    RAISE EXCEPTION 'unknown platform_config field: %', p_field;
  END IF;

  SELECT pc.value_type,
         CASE WHEN p_field = 'value' THEN pc.value ELSE pc.description_ko END
    INTO v_value_type, v_old_field_value
  FROM public.platform_config pc
  WHERE pc.key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown platform_config key: %', p_key;
  END IF;

  IF p_field = 'value' THEN
    UPDATE public.platform_config
    SET value = p_new_value, updated_at = now(), updated_by = p_admin_id
    WHERE key = p_key;
  ELSE
    UPDATE public.platform_config
    SET description_ko = p_new_value, updated_at = now(), updated_by = p_admin_id
    WHERE key = p_key;
  END IF;

  INSERT INTO public.platform_config_history
    (key, field, value_type, old_value, new_value, changed_by, changed_by_email)
  VALUES
    (p_key, p_field, v_value_type, v_old_field_value, p_new_value, p_admin_id, p_admin_email);

  RETURN QUERY SELECT v_old_field_value, v_value_type;
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_config(TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_platform_config(TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

-- ===========================================================================
-- Verification (run after, separately)
-- ===========================================================================
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_config' AND column_name = 'description_ko';
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_config_history' AND column_name = 'field';

-- Part 3 (run separately, by script, not SQL Editor): 12 keys seeded with a
-- Korean description_ko -- see scripts/ (deleted after running, one-off) and
-- the confirmation in the chat reply. Values match the English `description`
-- on the same row.
