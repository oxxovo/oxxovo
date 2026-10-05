-- =========================================================================
-- Phase 1 STEP 3 -- claimed_at column + the 15 content_*/dist_* RPCs
-- (design: reports/phase1_design_2026-10-04.md, final k, section 6-5b)
--
-- STATUS: RUN by TK on 2026-10-05. V3-1 (15 rows, no overloads), V3-2 (30 ACL rows),
-- V3-3 (gate missing = 0) and the live probes S-1..S-10 all passed.
-- This file is a record of what was Run, not something to Run again.
--
-- Notes on how it was actually Run:
--   * 3-2 (content_presign) went in with plain $$ quoting; 3-3..3-16 use unique
--     $fn_<name>$ tags and /* */ comments only. The editor hit "unterminated
--     dollar-quoted string" on 3-3 when blocks were collapsed to one line: a
--     "--" comment swallows the rest of a collapsed line. Do not collapse, and
--     keep tags unique and comments as /* */.
--   * After the 15 CREATEs, V3-1 showed proacl NULL on 11 functions: the
--     REVOKE/GRANT lines had not all executed (they were pasted joined on one line).
--     They were re-applied and V3-2 then showed exactly postgres + service_role
--     on all 15. proacl NULL means "default privileges", NOT "REVOKE done".
--     Always run V3-2 after creating functions.
--
-- Decisions made while writing this step (not in the design text):
--   * claimed_at on content_distributions: dist_sweep_unknown needs the claim time.
--   * content_presign rejects only above the LARGEST content_max_bytes_* value
--     (the request carries no kind/form); the exact cap is enforced in content_import.
--   * optional key content_presign_source_rate_per_hour for the source-wide limit
--     (falls back to content_presign_rate_per_hour). Not inserted.
--   * content_hold also does returned -> held (design 6-4 has the transition, no button).
--   * channels[{platform, role}] is built by Node (lib/content-kinds.ts); the RPC only
--     decides skipped_no_asset / skipped_oversize. x-channel fallback rule lives in TS.
--   * errors are RAISE EXCEPTION '<code>'; Node maps code -> HTTP (400/404/409/422/503).
--     outcome 'conflict' / 'idempotent' are return values, not errors.
--   * every RPC sets app.actor_email / app.actor_id (set_config, local) before writing,
--     so trg_contents_audit records the real actor instead of db:postgres.
-- =========================================================================

-- 3-0a: no content_*/dist_* functions yet. Control: trg_reject_mutation must show up (expect exactly 1 row).
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (proname ~ '^(content|dist)_' OR proname = 'trg_reject_mutation')
ORDER BY proname;


-- 3-0b: claimed_at must be absent. Control: status must be present (expect exactly 1 row: status).
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'content_distributions'
  AND column_name IN ('claimed_at', 'status');


-- 3-0c: config keys the RPCs read. Expect 8 rows (5 content_* + 3 news_publish_*).
SELECT key, value
FROM public.platform_config
WHERE key IN ('content_min_lead_minutes', 'content_max_bytes_default', 'content_dispatch_per_tick',
              'content_presign_ttl_seconds', 'content_presign_rate_per_hour',
              'news_publish_weekdays', 'news_publish_time', 'news_publish_timezone')
ORDER BY key;


-- 3-1: claim time for sending rows (dist_sweep_unknown needs it)
ALTER TABLE public.content_distributions ADD COLUMN claimed_at timestamptz;


-- 3-2: content_presign(source, source_ref, source_version, role, bytes, content_type)
CREATE FUNCTION public.content_presign(
  p_source text, p_source_ref text, p_source_version int,
  p_role text, p_bytes bigint, p_content_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_txt text; v_ttl int; v_rate int; v_rate_src int; v_max bigint;
  v_n_ref int; v_n_src int; v_key text; v_exp timestamptz;
BEGIN
  PERFORM set_config('app.actor_email', 'import:' || coalesce(p_source, ''), true);
  PERFORM set_config('app.actor_id', '', true);

  IF p_source IS NULL OR p_source NOT IN ('news_desk', 'production_os') THEN RAISE EXCEPTION 'source_invalid'; END IF;
  IF p_source_ref IS NULL OR p_source_ref !~ '^[A-Za-z0-9._-]{1,128}$'
     OR p_source_version IS NULL OR p_source_version < 1 THEN RAISE EXCEPTION 'request_invalid'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('main_16x9', 'main_9x16', 'thumbnail', 'script') THEN RAISE EXCEPTION 'role_invalid'; END IF;
  IF p_bytes IS NULL OR p_bytes <= 0 THEN RAISE EXCEPTION 'bytes_invalid'; END IF;
  IF p_content_type IS NULL OR p_content_type !~ '^[a-z]+/[a-z0-9.+-]+$' THEN RAISE EXCEPTION 'content_type_invalid'; END IF;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_presign_ttl_seconds';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_presign_ttl_seconds'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'config_invalid:content_presign_ttl_seconds'; END IF;
  v_ttl := v_txt::int;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_presign_rate_per_hour';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_presign_rate_per_hour'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'config_invalid:content_presign_rate_per_hour'; END IF;
  v_rate := v_txt::int;
  v_rate_src := v_rate;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_presign_source_rate_per_hour';
  IF v_txt IS NOT NULL THEN
    IF v_txt !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'config_invalid:content_presign_source_rate_per_hour'; END IF;
    v_rate_src := v_txt::int;
  END IF;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_max_bytes_default';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_max_bytes_default'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,17}$' THEN RAISE EXCEPTION 'config_invalid:content_max_bytes_default'; END IF;

  SELECT max(CASE WHEN value ~ '^[1-9][0-9]{0,17}$' THEN value::bigint END) INTO v_max
  FROM public.platform_config WHERE key ~ '^content_max_bytes_';
  IF p_bytes > v_max THEN RAISE EXCEPTION 'bytes_over_limit'; END IF;

  IF EXISTS (SELECT 1 FROM public.contents
             WHERE source = p_source AND source_ref = p_source_ref AND source_version = p_source_version) THEN
    RAISE EXCEPTION 'already_imported';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('presign:' || p_source));
  SELECT count(*) INTO v_n_ref FROM public.content_presigns
   WHERE source = p_source AND source_ref = p_source_ref AND created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_n_src FROM public.content_presigns
   WHERE source = p_source AND created_at > now() - interval '1 hour';
  IF v_n_ref >= v_rate OR v_n_src >= v_rate_src THEN RAISE EXCEPTION 'rate_limited'; END IF;

  v_key := 'imports/' || p_source || '/' || p_source_ref || '/v' || p_source_version || '/'
           || p_role || '-' || replace(gen_random_uuid()::text, '-', '');
  v_exp := now() + make_interval(secs => v_ttl);

  INSERT INTO public.content_presigns (key, source, source_ref, source_version, role, bytes, expires_at)
  VALUES (v_key, p_source, p_source_ref, p_source_version, p_role, p_bytes, v_exp);

  RETURN jsonb_build_object('key', v_key, 'expires_at', v_exp);
END;
$$;

REVOKE ALL ON FUNCTION public.content_presign(text, text, integer, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_presign(text, text, integer, text, bigint, text) TO service_role;


/* 3-3: content_import(source, payload jsonb). One transaction: contents + assets + distributions + presign consume.
   payload (Node-built): source_ref, source_version, kind, form, language, rights_status, rights_reason,
   title, description, caption, upstream_approved_by/at/approval_id, ai_generated, payload_hash,
   publish_at, late_for_slot, assets[{role, media_type, key?, url?, file_format, bytes, duration_sec, width, height, sha256, text_content?}],
   channels[{platform, role}] */
CREATE FUNCTION public.content_import(p_source text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_import$
DECLARE
  v_ref text; v_ver int; v_kind text; v_form text; v_lang text;
  v_rights text; v_rights_reason text; v_title text; v_desc text; v_caption text;
  v_appr_by text; v_appr_at timestamptz; v_appr_id text; v_ai boolean;
  v_hash text; v_publish_at timestamptz; v_late boolean;
  v_max_ver int; v_existing public.contents%ROWTYPE; v_prior public.contents%ROWTYPE;
  v_txt text; v_lead int; v_cap bigint;
  v_status text; v_held text; v_id uuid;
  v_asset jsonb; v_chan jsonb; v_role text; v_key text; v_bytes bigint; v_media text;
  v_chan_status text; v_asset_bytes bigint; v_has_main boolean := false;
  v_con text; v_out jsonb;
BEGIN
  PERFORM set_config('app.actor_email', 'import:' || coalesce(p_source, ''), true);
  PERFORM set_config('app.actor_id', '', true);

  IF p_source IS NULL OR p_source NOT IN ('news_desk', 'production_os') THEN RAISE EXCEPTION 'source_invalid'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'payload_invalid'; END IF;
  IF jsonb_typeof(p_payload -> 'ai_generated') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'payload_invalid:ai_generated'; END IF;
  IF jsonb_typeof(p_payload -> 'assets') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload -> 'channels') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload -> 'channels') = 0 THEN RAISE EXCEPTION 'payload_invalid:assets_or_channels'; END IF;

  BEGIN
    v_ref := p_payload ->> 'source_ref';
    v_ver := (p_payload ->> 'source_version')::int;
    v_kind := p_payload ->> 'kind';
    v_form := p_payload ->> 'form';
    v_lang := p_payload ->> 'language';
    v_rights := p_payload ->> 'rights_status';
    v_rights_reason := nullif(p_payload ->> 'rights_reason', '');
    v_title := nullif(p_payload ->> 'title', '');
    v_desc := nullif(p_payload ->> 'description', '');
    v_caption := nullif(p_payload ->> 'caption', '');
    v_appr_by := nullif(p_payload ->> 'upstream_approved_by', '');
    v_appr_at := (p_payload ->> 'upstream_approved_at')::timestamptz;
    v_appr_id := nullif(p_payload ->> 'upstream_approval_id', '');
    v_ai := (p_payload ->> 'ai_generated')::boolean;
    v_hash := nullif(p_payload ->> 'payload_hash', '');
    v_publish_at := (p_payload ->> 'publish_at')::timestamptz;
    v_late := coalesce((p_payload ->> 'late_for_slot')::boolean, false);
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format
            OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'payload_invalid';
  END;

  IF v_ref IS NULL OR v_ref !~ '^[A-Za-z0-9._-]{1,128}$' OR v_ver IS NULL OR v_ver < 1
     OR v_kind IS NULL OR v_form IS NULL OR v_lang IS NULL OR v_rights IS NULL OR v_title IS NULL
     OR v_appr_by IS NULL OR v_appr_at IS NULL OR v_appr_id IS NULL OR v_hash IS NULL
     OR v_publish_at IS NULL THEN RAISE EXCEPTION 'payload_invalid'; END IF;
  IF v_rights NOT IN ('cleared', 'restricted', 'blocked') THEN RAISE EXCEPTION 'payload_invalid:rights_status'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('import:' || p_source || ':' || v_ref));
  SELECT max(source_version) INTO v_max_ver FROM public.contents WHERE source = p_source AND source_ref = v_ref;
  IF v_max_ver IS NULL THEN
    IF v_ver <> 1 THEN RAISE EXCEPTION 'version_invalid'; END IF;
  ELSIF v_ver = v_max_ver THEN
    SELECT * INTO v_existing FROM public.contents
     WHERE source = p_source AND source_ref = v_ref AND source_version = v_ver;
    RETURN jsonb_build_object(
      'outcome', CASE WHEN v_existing.payload_hash = v_hash THEN 'idempotent' ELSE 'conflict' END,
      'idempotent', (v_existing.payload_hash = v_hash),
      'id', v_existing.id, 'status', v_existing.status,
      'rights_status', v_existing.rights_status, 'held_reason', v_existing.held_reason);
  ELSIF v_ver = v_max_ver + 1 THEN
    SELECT * INTO v_prior FROM public.contents
     WHERE source = p_source AND source_ref = v_ref AND source_version = v_max_ver;
    IF v_appr_at <= v_prior.upstream_approved_at
       OR (v_prior.returned_at IS NOT NULL AND v_appr_at <= v_prior.returned_at) THEN
      RAISE EXCEPTION 'approval_not_newer';
    END IF;
  ELSE
    RAISE EXCEPTION 'version_invalid';
  END IF;

  IF v_rights = 'cleared' AND v_rights_reason IS NOT NULL THEN RAISE EXCEPTION 'rights_reason_forbidden'; END IF;
  IF v_rights <> 'cleared' AND (v_rights_reason IS NULL OR char_length(v_rights_reason) > 2000) THEN
    RAISE EXCEPTION 'rights_reason_required';
  END IF;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_min_lead_minutes';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_min_lead_minutes'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'config_invalid:content_min_lead_minutes'; END IF;
  v_lead := v_txt::int;
  IF v_publish_at < now() + make_interval(mins => v_lead) THEN RAISE EXCEPTION 'lead_too_short'; END IF;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_max_bytes_' || v_kind || '_' || v_form;
  IF v_txt IS NULL THEN
    SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_max_bytes_default';
    IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_max_bytes_default'; END IF;
  END IF;
  IF v_txt !~ '^[1-9][0-9]{0,17}$' THEN RAISE EXCEPTION 'config_invalid:content_max_bytes'; END IF;
  v_cap := v_txt::bigint;

  IF v_kind = 'news' THEN
    SELECT value INTO v_txt FROM public.platform_config WHERE key = 'news_publish_weekdays';
    IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:news_publish_weekdays'; END IF;
    IF v_txt !~ '^(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*$' THEN
      RAISE EXCEPTION 'config_invalid:news_publish_weekdays';
    END IF;
    SELECT value INTO v_txt FROM public.platform_config WHERE key = 'news_publish_time';
    IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:news_publish_time'; END IF;
    IF v_txt !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'config_invalid:news_publish_time'; END IF;
    SELECT value INTO v_txt FROM public.platform_config WHERE key = 'news_publish_timezone';
    IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:news_publish_timezone'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_txt) THEN
      RAISE EXCEPTION 'config_invalid:news_publish_timezone';
    END IF;
  END IF;

  IF v_rights = 'cleared' AND v_ver = 1 AND NOT v_late THEN v_status := 'scheduled'; ELSE v_status := 'held'; END IF;
  v_held := CASE WHEN v_late THEN 'late_for_slot' ELSE NULL END;

  BEGIN
    INSERT INTO public.contents
      (kind, surface, source, source_ref, source_version, title, description, caption, language, form,
       rights_status, status, publish_at, upstream_approved_by, upstream_approved_at, upstream_approval_id,
       ai_generated, payload_hash, held_reason, rights_reason)
    VALUES
      (v_kind, 'video', p_source, v_ref, v_ver, v_title, v_desc, v_caption, v_lang, v_form,
       v_rights, v_status, v_publish_at, v_appr_by, v_appr_at, v_appr_id,
       v_ai, v_hash, v_held, v_rights_reason)
    RETURNING id INTO v_id;

    FOR v_asset IN SELECT value FROM jsonb_array_elements(p_payload -> 'assets') LOOP
      v_role := v_asset ->> 'role';
      v_media := v_asset ->> 'media_type';
      v_key := nullif(v_asset ->> 'key', '');
      v_bytes := (v_asset ->> 'bytes')::bigint;
      IF v_role IS NULL OR v_role NOT IN ('main_16x9', 'main_9x16', 'thumbnail', 'script') THEN
        RAISE EXCEPTION 'asset_invalid:role';
      END IF;
      IF v_role IN ('main_16x9', 'main_9x16') THEN v_has_main := true; END IF;

      IF v_media = 'text' THEN
        IF v_key IS NOT NULL OR nullif(v_asset ->> 'text_content', '') IS NULL THEN
          RAISE EXCEPTION 'asset_invalid:%', v_role;
        END IF;
      ELSE
        IF v_key IS NULL OR nullif(v_asset ->> 'url', '') IS NULL OR v_bytes IS NULL OR v_bytes <= 0 THEN
          RAISE EXCEPTION 'asset_invalid:%', v_role;
        END IF;
        UPDATE public.content_presigns SET consumed_at = now()
         WHERE key = v_key AND source = p_source AND source_ref = v_ref AND source_version = v_ver
           AND role = v_role AND bytes = v_bytes AND consumed_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'presign_invalid:%', v_role; END IF;
      END IF;

      INSERT INTO public.content_assets
        (content_id, role, media_type, file_format, url, sha256, text_content, duration_sec, width, height, bytes)
      VALUES
        (v_id, v_role, v_media, v_asset ->> 'file_format', nullif(v_asset ->> 'url', ''),
         nullif(v_asset ->> 'sha256', ''), nullif(v_asset ->> 'text_content', ''),
         (v_asset ->> 'duration_sec')::numeric, (v_asset ->> 'width')::int, (v_asset ->> 'height')::int, v_bytes);
    END LOOP;
    IF NOT v_has_main THEN RAISE EXCEPTION 'main_asset_required'; END IF;

    FOR v_chan IN SELECT value FROM jsonb_array_elements(p_payload -> 'channels') LOOP
      v_role := v_chan ->> 'role';
      SELECT a.bytes INTO v_asset_bytes FROM public.content_assets a WHERE a.content_id = v_id AND a.role = v_role;
      IF NOT FOUND THEN v_chan_status := 'skipped_no_asset';
      ELSIF v_asset_bytes IS NOT NULL AND v_asset_bytes > v_cap THEN v_chan_status := 'skipped_oversize';
      ELSE v_chan_status := 'queued';
      END IF;
      INSERT INTO public.content_distributions (content_id, platform, status, scheduled_at)
      VALUES (v_id, v_chan ->> 'platform', v_chan_status, v_publish_at);
    END LOOP;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_con = CONSTRAINT_NAME;
      IF v_con = 'contents_source_approval_uq' THEN RAISE EXCEPTION 'approval_id_reused';
      ELSIF v_con = 'contents_source_ref_ver_uq' THEN RAISE EXCEPTION 'concurrent_import';
      ELSIF v_con = 'content_distributions_content_platform_uq' THEN RAISE EXCEPTION 'channels_invalid:duplicate_platform';
      ELSE RAISE EXCEPTION 'conflict:%', v_con;
      END IF;
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_con = CONSTRAINT_NAME;
      RAISE EXCEPTION 'check_violation:%', v_con;
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'payload_invalid:asset_fields';
  END;

  SELECT jsonb_agg(jsonb_build_object('platform', d.platform, 'status', d.status) ORDER BY d.platform)
    INTO v_out FROM public.content_distributions d WHERE d.content_id = v_id;

  RETURN jsonb_build_object('outcome', 'created', 'id', v_id, 'status', v_status,
                            'rights_status', v_rights, 'held_reason', v_held, 'channels', v_out);
END;
$fn_content_import$;

REVOKE ALL ON FUNCTION public.content_import(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_import(text, jsonb) TO service_role;


/* 3-4: content_rights_down(source, source_ref, source_version, rights_status, rights_reason) */
CREATE FUNCTION public.content_rights_down(
  p_source text, p_source_ref text, p_source_version int, p_rights_status text, p_rights_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_rights_down$
DECLARE
  v_c public.contents%ROWTYPE; v_old int; v_new int; v_cancelled int := 0; v_sending int; v_posted jsonb;
BEGIN
  PERFORM set_config('app.actor_email', 'import:' || coalesce(p_source, ''), true);
  PERFORM set_config('app.actor_id', '', true);

  IF p_source IS NULL OR p_source NOT IN ('news_desk', 'production_os') THEN RAISE EXCEPTION 'source_invalid'; END IF;
  IF p_source_ref IS NULL OR p_source_ref !~ '^[A-Za-z0-9._-]{1,128}$'
     OR p_source_version IS NULL OR p_source_version < 1 THEN RAISE EXCEPTION 'request_invalid'; END IF;
  IF p_rights_status IS NULL OR p_rights_status NOT IN ('restricted', 'blocked') THEN RAISE EXCEPTION 'rights_up_denied'; END IF;
  IF nullif(btrim(p_rights_reason), '') IS NULL OR char_length(p_rights_reason) > 2000 THEN
    RAISE EXCEPTION 'rights_reason_required';
  END IF;

  SELECT * INTO v_c FROM public.contents
   WHERE source = p_source AND source_ref = p_source_ref AND source_version = p_source_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  v_old := CASE v_c.rights_status WHEN 'cleared' THEN 0 WHEN 'restricted' THEN 1 ELSE 2 END;
  v_new := CASE p_rights_status WHEN 'restricted' THEN 1 ELSE 2 END;
  IF v_new < v_old THEN RAISE EXCEPTION 'rights_up_denied'; END IF;
  IF v_new = v_old THEN
    RETURN jsonb_build_object('outcome', 'idempotent', 'idempotent', true, 'id', v_c.id,
                              'status', v_c.status, 'rights_status', v_c.rights_status);
  END IF;

  UPDATE public.contents
     SET rights_status = p_rights_status, rights_reason = p_rights_reason,
         status = CASE WHEN status = 'scheduled' THEN 'held' ELSE status END
   WHERE id = v_c.id;

  UPDATE public.content_distributions SET status = 'cancelled' WHERE content_id = v_c.id AND status = 'queued';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  SELECT count(*) INTO v_sending FROM public.content_distributions WHERE content_id = v_c.id AND status = 'sending';
  SELECT coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'external_url', external_url)), '[]'::jsonb)
    INTO v_posted FROM public.content_distributions WHERE content_id = v_c.id AND status = 'posted';

  RETURN jsonb_build_object('outcome', 'lowered', 'id', v_c.id,
    'status', CASE WHEN v_c.status = 'scheduled' THEN 'held' ELSE v_c.status END,
    'rights_status', p_rights_status, 'cancelled', v_cancelled, 'sending', v_sending, 'posted', v_posted);
END;
$fn_content_rights_down$;

REVOKE ALL ON FUNCTION public.content_rights_down(text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_rights_down(text, text, integer, text, text) TO service_role;


/* 3-5: content_hold(content_id, actor_id, actor_email): scheduled -> held, and returned -> held (mis-return recovery) */
CREATE FUNCTION public.content_hold(p_content_id uuid, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_hold$
DECLARE
  v_c public.contents%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status NOT IN ('scheduled', 'returned') THEN RAISE EXCEPTION 'invalid_transition:%->held', v_c.status; END IF;

  UPDATE public.contents SET status = 'held', held_reason = 'manual' WHERE id = v_c.id;
  RETURN jsonb_build_object('id', v_c.id, 'status', 'held', 'from', v_c.status);
END;
$fn_content_hold$;

REVOKE ALL ON FUNCTION public.content_hold(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_hold(uuid, uuid, text) TO service_role;


/* 3-6: content_release(content_id, actor_id, actor_email): held -> scheduled, publish_at = now(), requeue cancelled rows */
CREATE FUNCTION public.content_release(p_content_id uuid, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_release$
DECLARE
  v_c public.contents%ROWTYPE; v_mains int; v_with_url int; v_requeued int := 0;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status <> 'held' THEN RAISE EXCEPTION 'invalid_transition:%->scheduled', v_c.status; END IF;

  IF v_c.rights_status <> 'cleared' THEN RAISE EXCEPTION 'precondition_failed:rights_not_cleared'; END IF;
  SELECT count(*), count(*) FILTER (WHERE coalesce(url, '') <> '') INTO v_mains, v_with_url
    FROM public.content_assets WHERE content_id = v_c.id AND role IN ('main_16x9', 'main_9x16');
  IF v_mains = 0 THEN RAISE EXCEPTION 'precondition_failed:no_main_asset'; END IF;
  IF v_with_url = 0 THEN RAISE EXCEPTION 'precondition_failed:asset_url_empty'; END IF;

  UPDATE public.contents SET status = 'scheduled', held_reason = NULL, publish_at = now() WHERE id = v_c.id;

  WITH r AS (
    UPDATE public.content_distributions
       SET status = 'queued', attempts = 0, next_attempt_at = NULL, claimed_at = NULL
     WHERE content_id = v_c.id AND status = 'cancelled'
    RETURNING platform
  )
  INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason)
  SELECT v_c.id, r.platform, NULL, 'requeued', 'release by ' || p_actor_email FROM r;
  GET DIAGNOSTICS v_requeued = ROW_COUNT;

  RETURN jsonb_build_object('id', v_c.id, 'status', 'scheduled', 'requeued', v_requeued);
END;
$fn_content_release$;

REVOKE ALL ON FUNCTION public.content_release(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_release(uuid, uuid, text) TO service_role;


/* 3-7: content_return(content_id, reason, actor_id, actor_email): scheduled/held/hidden -> returned, queued rows -> cancelled */
CREATE FUNCTION public.content_return(p_content_id uuid, p_reason text, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_return$
DECLARE
  v_c public.contents%ROWTYPE; v_cancelled int := 0; v_posted jsonb;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  IF nullif(btrim(p_reason), '') IS NULL OR char_length(p_reason) > 2000 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status NOT IN ('scheduled', 'held', 'hidden') THEN RAISE EXCEPTION 'invalid_transition:%->returned', v_c.status; END IF;

  UPDATE public.contents
     SET status = 'returned', returned_reason = p_reason, returned_by = p_actor_id, returned_at = now()
   WHERE id = v_c.id;

  UPDATE public.content_distributions SET status = 'cancelled' WHERE content_id = v_c.id AND status = 'queued';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  SELECT coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'external_url', external_url)), '[]'::jsonb)
    INTO v_posted FROM public.content_distributions WHERE content_id = v_c.id AND status = 'posted';

  RETURN jsonb_build_object('id', v_c.id, 'status', 'returned', 'cancelled', v_cancelled, 'posted', v_posted);
END;
$fn_content_return$;

REVOKE ALL ON FUNCTION public.content_return(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_return(uuid, text, uuid, text) TO service_role;


/* 3-8: content_hide(content_id, actor_id, actor_email): scheduled -> hidden */
CREATE FUNCTION public.content_hide(p_content_id uuid, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_hide$
DECLARE
  v_c public.contents%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status <> 'scheduled' THEN RAISE EXCEPTION 'invalid_transition:%->hidden', v_c.status; END IF;

  UPDATE public.contents SET status = 'hidden' WHERE id = v_c.id;
  RETURN jsonb_build_object('id', v_c.id, 'status', 'hidden');
END;
$fn_content_hide$;

REVOKE ALL ON FUNCTION public.content_hide(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_hide(uuid, uuid, text) TO service_role;


/* 3-9: content_unhide(content_id, actor_id, actor_email): hidden -> held (never straight to scheduled) */
CREATE FUNCTION public.content_unhide(p_content_id uuid, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_unhide$
DECLARE
  v_c public.contents%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status <> 'hidden' THEN RAISE EXCEPTION 'invalid_transition:%->held', v_c.status; END IF;

  UPDATE public.contents SET status = 'held', held_reason = 'manual' WHERE id = v_c.id;
  RETURN jsonb_build_object('id', v_c.id, 'status', 'held');
END;
$fn_content_unhide$;

REVOKE ALL ON FUNCTION public.content_unhide(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_unhide(uuid, uuid, text) TO service_role;


/* 3-10: content_update_meta(content_id, title, description, caption, actor_id, actor_email)
   NULL = leave unchanged; empty string = clear (description/caption); title may not be empty. */
CREATE FUNCTION public.content_update_meta(
  p_content_id uuid, p_title text, p_description text, p_caption text, p_actor_id uuid, p_actor_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_update_meta$
DECLARE
  v_c public.contents%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  IF p_title IS NULL AND p_description IS NULL AND p_caption IS NULL THEN RAISE EXCEPTION 'nothing_to_update'; END IF;
  IF p_title IS NOT NULL AND btrim(p_title) = '' THEN RAISE EXCEPTION 'title_empty'; END IF;

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  UPDATE public.contents
     SET title = coalesce(p_title, title),
         description = CASE WHEN p_description IS NULL THEN description WHEN p_description = '' THEN NULL ELSE p_description END,
         caption = CASE WHEN p_caption IS NULL THEN caption WHEN p_caption = '' THEN NULL ELSE p_caption END
   WHERE id = v_c.id;
  RETURN jsonb_build_object('id', v_c.id, 'status', v_c.status);
END;
$fn_content_update_meta$;

REVOKE ALL ON FUNCTION public.content_update_meta(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_update_meta(uuid, text, text, text, uuid, text) TO service_role;


/* 3-11: content_set_publish_at(content_id, publish_at, actor_id, actor_email): floor re-checked from config */
CREATE FUNCTION public.content_set_publish_at(
  p_content_id uuid, p_publish_at timestamptz, p_actor_id uuid, p_actor_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_content_set_publish_at$
DECLARE
  v_c public.contents%ROWTYPE; v_txt text; v_lead int;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  IF p_publish_at IS NULL THEN RAISE EXCEPTION 'payload_invalid'; END IF;

  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_min_lead_minutes';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_min_lead_minutes'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'config_invalid:content_min_lead_minutes'; END IF;
  v_lead := v_txt::int;
  IF p_publish_at < now() + make_interval(mins => v_lead) THEN RAISE EXCEPTION 'lead_too_short'; END IF;

  SELECT * INTO v_c FROM public.contents WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.status NOT IN ('scheduled', 'held') THEN RAISE EXCEPTION 'invalid_transition:%->publish_at', v_c.status; END IF;

  UPDATE public.contents SET publish_at = p_publish_at WHERE id = v_c.id;
  RETURN jsonb_build_object('id', v_c.id, 'publish_at', p_publish_at);
END;
$fn_content_set_publish_at$;

REVOKE ALL ON FUNCTION public.content_set_publish_at(uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_set_publish_at(uuid, timestamptz, uuid, text) TO service_role;


/* 3-12: dist_claim(open_kinds, limit_n, max_attempts): queued / retryable failed -> sending, SKIP LOCKED.
   Empty or NULL open_kinds, or limit_n <= 0, claims nothing (fail-closed). max_attempts NULL = no retries. */
CREATE FUNCTION public.dist_claim(p_open_kinds text[], p_limit_n int, p_max_attempts int) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_dist_claim$
DECLARE
  v_out jsonb;
BEGIN
  IF p_open_kinds IS NULL OR cardinality(p_open_kinds) = 0 OR p_limit_n IS NULL OR p_limit_n <= 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH picked AS (
    SELECT d.id
      FROM public.content_distributions d
      JOIN public.contents c ON c.id = d.content_id
     WHERE c.status = 'scheduled' AND c.rights_status = 'cleared' AND c.publish_at <= now()
       AND c.kind = ANY (p_open_kinds)
       AND (d.status = 'queued'
            OR (d.status = 'failed' AND d.next_attempt_at IS NOT NULL AND d.next_attempt_at <= now()
                AND d.attempts < coalesce(p_max_attempts, 0)))
     ORDER BY c.publish_at, d.created_at, d.id
     LIMIT p_limit_n
       FOR UPDATE OF d SKIP LOCKED
  ),
  upd AS (
    UPDATE public.content_distributions d
       SET status = 'sending', claimed_at = now()
      FROM picked
     WHERE d.id = picked.id
    RETURNING d.id, d.content_id, d.platform, d.account, d.attempts
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'dist_id', u.id, 'content_id', u.content_id, 'platform', u.platform, 'account', u.account,
           'attempts', u.attempts, 'kind', c.kind, 'form', c.form, 'language', c.language,
           'title', c.title, 'caption', c.caption) ORDER BY c.publish_at, u.id), '[]'::jsonb)
    INTO v_out
    FROM upd u JOIN public.contents c ON c.id = u.content_id;

  RETURN v_out;
END;
$fn_dist_claim$;

REVOKE ALL ON FUNCTION public.dist_claim(text[], integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dist_claim(text[], integer, integer) TO service_role;


/* 3-13: dist_mark(dist_id, result, http_status, error, external_id, caption_sent, backoff_base_minutes)
   Only a 'sending' row can be marked. A row swept to 'unknown' meanwhile is resolved by a human. */
CREATE FUNCTION public.dist_mark(
  p_dist_id uuid, p_result text, p_http_status int, p_error text,
  p_external_id text, p_caption_sent text, p_backoff_base_minutes int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_dist_mark$
DECLARE
  v_d public.content_distributions%ROWTYPE; v_next timestamptz; v_attempt int;
BEGIN
  IF p_result IS NULL OR p_result NOT IN ('sent', 'failed', 'failed_terminal', 'unknown', 'stopped_by_switch') THEN
    RAISE EXCEPTION 'result_invalid';
  END IF;

  SELECT * INTO v_d FROM public.content_distributions WHERE id = p_dist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_d.status <> 'sending' THEN RAISE EXCEPTION 'not_sending'; END IF;
  v_attempt := v_d.attempts + 1;

  IF p_result = 'sent' THEN
    UPDATE public.content_distributions
       SET status = 'posted', published_at = now(), external_id = p_external_id,
           caption_sent = coalesce(p_caption_sent, caption_sent), last_error = NULL,
           next_attempt_at = NULL, claimed_at = NULL
     WHERE id = v_d.id;
  ELSIF p_result = 'failed' THEN
    v_next := CASE WHEN p_backoff_base_minutes IS NULL OR p_backoff_base_minutes <= 0 THEN NULL
                   ELSE now() + (p_backoff_base_minutes::float8 * power(2, least(v_d.attempts, 20))) * interval '1 minute' END;
    UPDATE public.content_distributions
       SET status = 'failed', attempts = v_attempt, last_error = p_error,
           caption_sent = coalesce(p_caption_sent, caption_sent), next_attempt_at = v_next, claimed_at = NULL
     WHERE id = v_d.id;
  ELSIF p_result = 'failed_terminal' THEN
    UPDATE public.content_distributions
       SET status = 'failed', attempts = v_attempt, last_error = p_error, next_attempt_at = NULL, claimed_at = NULL
     WHERE id = v_d.id;
  ELSIF p_result = 'unknown' THEN
    UPDATE public.content_distributions
       SET status = 'unknown', last_error = p_error, next_attempt_at = NULL, claimed_at = NULL
     WHERE id = v_d.id;
  ELSE
    UPDATE public.content_distributions
       SET status = 'queued', claimed_at = NULL
     WHERE id = v_d.id;
    v_attempt := NULL;
  END IF;

  INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason, http_status)
  VALUES (v_d.content_id, v_d.platform, v_attempt, p_result, p_error, p_http_status);

  RETURN jsonb_build_object('dist_id', v_d.id, 'result', p_result,
    'status', (SELECT status FROM public.content_distributions WHERE id = v_d.id),
    'attempts', (SELECT attempts FROM public.content_distributions WHERE id = v_d.id),
    'next_attempt_at', (SELECT next_attempt_at FROM public.content_distributions WHERE id = v_d.id));
END;
$fn_dist_mark$;

REVOKE ALL ON FUNCTION public.dist_mark(uuid, text, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dist_mark(uuid, text, integer, text, text, text, integer) TO service_role;


/* 3-14: dist_sweep_unknown(threshold_seconds): stale 'sending' rows -> unknown (+ log row each) */
CREATE FUNCTION public.dist_sweep_unknown(p_threshold_seconds int) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_dist_sweep_unknown$
DECLARE
  v_n int; v_ids jsonb;
BEGIN
  IF p_threshold_seconds IS NULL OR p_threshold_seconds <= 0 THEN RAISE EXCEPTION 'threshold_invalid'; END IF;

  WITH s AS (
    UPDATE public.content_distributions
       SET status = 'unknown', last_error = 'swept: still sending after threshold', claimed_at = NULL
     WHERE status = 'sending'
       AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => p_threshold_seconds))
    RETURNING id, content_id, platform
  ),
  l AS (
    INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason)
    SELECT content_id, platform, NULL, 'unknown', 'swept' FROM s
    RETURNING 1
  )
  SELECT count(*), coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_n, v_ids FROM s;

  RETURN jsonb_build_object('count', v_n, 'ids', v_ids);
END;
$fn_dist_sweep_unknown$;

REVOKE ALL ON FUNCTION public.dist_sweep_unknown(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dist_sweep_unknown(integer) TO service_role;


/* 3-15: dist_mark_posted(dist_id, external_url, actor_id, actor_email): unknown/failed -> posted (human checked the SNS) */
CREATE FUNCTION public.dist_mark_posted(p_dist_id uuid, p_external_url text, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_dist_mark_posted$
DECLARE
  v_d public.content_distributions%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  IF p_external_url IS NOT NULL AND p_external_url !~ '^https://' THEN RAISE EXCEPTION 'url_invalid'; END IF;

  SELECT * INTO v_d FROM public.content_distributions WHERE id = p_dist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_d.status NOT IN ('unknown', 'failed') THEN RAISE EXCEPTION 'invalid_transition:%->posted', v_d.status; END IF;

  UPDATE public.content_distributions
     SET status = 'posted', external_url = coalesce(p_external_url, external_url),
         published_at = now(), next_attempt_at = NULL, claimed_at = NULL
   WHERE id = v_d.id;

  INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason)
  VALUES (v_d.content_id, v_d.platform, NULL, 'manual_resolved', 'marked posted by ' || p_actor_email);

  RETURN jsonb_build_object('dist_id', v_d.id, 'status', 'posted');
END;
$fn_dist_mark_posted$;

REVOKE ALL ON FUNCTION public.dist_mark_posted(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dist_mark_posted(uuid, text, uuid, text) TO service_role;


/* 3-16: dist_requeue(dist_id, actor_id, actor_email): unknown/failed -> queued, attempts reset */
CREATE FUNCTION public.dist_requeue(p_dist_id uuid, p_actor_id uuid, p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn_dist_requeue$
DECLARE
  v_d public.content_distributions%ROWTYPE;
BEGIN
  IF nullif(btrim(p_actor_email), '') IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  PERFORM set_config('app.actor_email', p_actor_email, true);
  PERFORM set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);

  SELECT * INTO v_d FROM public.content_distributions WHERE id = p_dist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_d.status NOT IN ('unknown', 'failed') THEN RAISE EXCEPTION 'invalid_transition:%->queued', v_d.status; END IF;

  UPDATE public.content_distributions
     SET status = 'queued', attempts = 0, next_attempt_at = NULL, claimed_at = NULL
   WHERE id = v_d.id;

  INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason)
  VALUES (v_d.content_id, v_d.platform, NULL, 'manual_resolved', 'requeued by ' || p_actor_email);

  RETURN jsonb_build_object('dist_id', v_d.id, 'status', 'queued');
END;
$fn_dist_requeue$;

REVOKE ALL ON FUNCTION public.dist_requeue(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dist_requeue(uuid, uuid, text) TO service_role;


-- V3-1: exactly 15 rows, no duplicate names (overload check), prosecdef true, search_path set.
SELECT p.oid::regprocedure::text AS sig, p.prosecdef, p.proacl::text, p.proconfig::text
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(content|dist)_'
ORDER BY 1;


-- V3-2: who may EXECUTE. Expect 30 rows: postgres + service_role for each of the 15 functions, nobody else.
-- (proacl NULL in V3-1 is NOT proof of a REVOKE; this query is the real check.)
SELECT p.proname, coalesce(r.rolname, 'PUBLIC') AS grantee
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(p.proacl) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(content|dist)_'
ORDER BY p.proname, grantee;


-- V3-3: deploy gate still clean after the ALTER. Expect missing = 0.
SELECT count(*) AS missing FROM public.check_service_role_grants();


-- =========================================================================
-- LIVE PROBES (run once, in order; probe rows stay forever, restricted only).
-- Results on 2026-10-05: all as expected (see EOD report).
-- Paths NOT live-tested (need scheduled + cleared; deferred to the step-6 stub test):
--   content_hide, content_unhide, content_release success path, dist_claim claim path, dist_mark('sent').
-- =========================================================================

-- S-1 (run exactly once): expect {key, expires_at}
SELECT public.content_presign('news_desk', 'probe-rpc-20261005', 1, 'main_16x9', 1000, 'video/mp4');

-- S-2: expect outcome=created, status=held, channels: instagram skipped_no_asset, youtube queued.
-- S-3 = S-2 re-run unchanged (idempotent). S-4 = S-2 with 'probe-rpc-hash-1' -> 'probe-rpc-hash-2' (conflict).
SELECT public.content_import('news_desk', jsonb_build_object(
  'source_ref', 'probe-rpc-20261005', 'source_version', 1, 'kind', 'news', 'form', 'short', 'language', 'ko',
  'rights_status', 'restricted', 'rights_reason', 'rpc probe, never sendable',
  'title', 'probe rpc', 'description', NULL, 'caption', NULL,
  'upstream_approved_by', 'probe', 'upstream_approved_at', to_jsonb(now()),
  'upstream_approval_id', 'probe-rpc-approval-20261005', 'ai_generated', true,
  'payload_hash', 'probe-rpc-hash-1', 'publish_at', to_jsonb(now() + interval '1 day'), 'late_for_slot', false,
  'assets', jsonb_build_array(jsonb_build_object(
      'role', 'main_16x9', 'media_type', 'video',
      'key', (SELECT key FROM public.content_presigns WHERE source_ref = 'probe-rpc-20261005' LIMIT 1),
      'url', 'https://probe.invalid/probe.mp4', 'file_format', 'mp4', 'bytes', 1000,
      'sha256', repeat('0', 64))),
  'channels', jsonb_build_array(
      jsonb_build_object('platform', 'youtube', 'role', 'main_16x9'),
      jsonb_build_object('platform', 'instagram', 'role', 'main_9x16'))
));

-- S-2x: failed import must leave nothing behind. Expect ERROR presign_invalid:main_16x9
SELECT public.content_import('news_desk', jsonb_build_object(
  'source_ref', 'probe-rpc-fail-20261005', 'source_version', 1, 'kind', 'news', 'form', 'short', 'language', 'ko',
  'rights_status', 'restricted', 'rights_reason', 'rpc probe, failed import',
  'title', 'probe fail', 'description', NULL, 'caption', NULL,
  'upstream_approved_by', 'probe', 'upstream_approved_at', to_jsonb(now()),
  'upstream_approval_id', 'probe-rpc-fail-approval-20261005', 'ai_generated', true,
  'payload_hash', 'probe-rpc-fail-hash', 'publish_at', to_jsonb(now() + interval '1 day'), 'late_for_slot', false,
  'assets', jsonb_build_array(jsonb_build_object(
      'role', 'main_16x9', 'media_type', 'video', 'key', 'imports/news_desk/not-issued/key',
      'url', 'https://probe.invalid/x.mp4', 'file_format', 'mp4', 'bytes', 1000, 'sha256', repeat('0', 64))),
  'channels', jsonb_build_array(jsonb_build_object('platform', 'youtube', 'role', 'main_16x9'))
));

-- S-2y: after S-2x. Expect 0 rows.
SELECT c.id, c.source_ref FROM public.contents c WHERE c.source_ref = 'probe-rpc-fail-20261005';

-- S-5: expect outcome=lowered, status=held, cancelled=1, rights_status=blocked.
SELECT public.content_rights_down('news_desk', 'probe-rpc-20261005', 1, 'blocked', 'rpc probe lowering');

-- S-6: expect ERROR rights_up_denied
SELECT public.content_rights_down('news_desk', 'probe-rpc-20261005', 1, 'restricted', 'rpc probe raising');

-- S-7: expect ERROR precondition_failed:rights_not_cleared
SELECT public.content_release(c.id, NULL, 'probe@oxxovo') FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';

-- S-8a: expect {id, status}
SELECT public.content_update_meta(c.id, 'probe rpc 2', NULL, NULL, NULL, 'probe@oxxovo')
FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';

-- S-8b: attribution. import:news_desk for import/rights rows, probe@oxxovo for the title. No db:postgres.
SELECT h.field, h.old_value, h.new_value, h.changed_by_email
FROM public.contents_history h JOIN public.contents c ON c.id = h.content_id
WHERE c.source_ref = 'probe-rpc-20261005'
ORDER BY h.changed_at, h.field;

-- S-9a: probe youtube row into sending by hand. Expect 1 row.
UPDATE public.content_distributions d SET status = 'sending', claimed_at = now()
FROM public.contents c WHERE d.content_id = c.id AND c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube'
RETURNING d.id, d.status, d.claimed_at;

-- S-9b: expect status=failed, attempts=1, next_attempt_at about now()+5 minutes.
SELECT public.dist_mark(d.id, 'failed', 400, 'rpc probe error', NULL, NULL, 5)
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube';

-- S-9c: expect ERROR not_sending
SELECT public.dist_mark(d.id, 'sent', 200, NULL, 'x', 'x', NULL)
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube';

-- S-9d: expect []
SELECT public.dist_claim(ARRAY['news'], 5, 3);

-- S-9e: expect status=queued
SELECT public.dist_requeue(d.id, NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube';

-- S-9f: make the row look stale-sending (claimed 2 days ago). Expect 1 row.
UPDATE public.content_distributions d SET status = 'sending', claimed_at = now() - interval '2 days'
FROM public.contents c WHERE d.content_id = c.id AND c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube'
RETURNING d.id, d.status, d.claimed_at;

-- S-9g-pre: before the sweep. Expect exactly 1 row: the probe youtube row.
SELECT d.id, c.source_ref, d.platform, d.status, d.claimed_at
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE d.status = 'sending';

-- S-9g: expect count = 1, probe row now unknown.
SELECT public.dist_sweep_unknown(3600);

-- S-9h: expect status=posted.
SELECT public.dist_mark_posted(d.id, 'https://probe.invalid/post', NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-rpc-20261005' AND d.platform = 'youtube';

-- S-9i: log trail. Expect failed, manual_resolved, unknown(swept), manual_resolved in order.
SELECT l.result, l.attempt_no, l.reason, l.http_status
FROM public.content_publish_log l JOIN public.contents c ON c.id = l.content_id
WHERE c.source_ref = 'probe-rpc-20261005'
ORDER BY l.created_at;

-- S-10a: expect ERROR lead_too_short
SELECT public.content_set_publish_at(c.id, now(), NULL, 'probe@oxxovo')
FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';

-- S-10b: expect status=returned.
SELECT public.content_return(c.id, 'rpc probe return', NULL, 'probe@oxxovo')
FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';

-- S-10c: expect status=held, from=returned.
SELECT public.content_hold(c.id, NULL, 'probe@oxxovo')
FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';

-- S-10d: close the probe: return again. Expect status=returned.
SELECT public.content_return(c.id, 'rpc probe closed', NULL, 'probe@oxxovo')
FROM public.contents c WHERE c.source_ref = 'probe-rpc-20261005';


-- =========================================================================
-- REVERT (do NOT run with the above). Probe rows stay in contents after a revert.
-- =========================================================================

-- X1: drop the 15 functions (exact signatures)
DROP FUNCTION IF EXISTS public.content_import(text, jsonb);
DROP FUNCTION IF EXISTS public.content_presign(text, text, integer, text, bigint, text);
DROP FUNCTION IF EXISTS public.content_rights_down(text, text, integer, text, text);
DROP FUNCTION IF EXISTS public.content_hold(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.content_release(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.content_return(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.content_hide(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.content_unhide(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.content_update_meta(uuid, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.content_set_publish_at(uuid, timestamptz, uuid, text);
DROP FUNCTION IF EXISTS public.dist_claim(text[], integer, integer);
DROP FUNCTION IF EXISTS public.dist_mark(uuid, text, integer, text, text, text, integer);
DROP FUNCTION IF EXISTS public.dist_sweep_unknown(integer);
DROP FUNCTION IF EXISTS public.dist_mark_posted(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.dist_requeue(uuid, uuid, text);

-- X2: remove claimed_at (only if no code reads it yet)
ALTER TABLE public.content_distributions DROP COLUMN claimed_at;
