-- Phase 1 STEP 3b -- redefine content_import + dist_mark_posted, then add 2 keys, then live re-probe.
-- HQ/Jenny2 decision 2026-10-05. NOT YET RUN. TK runs; Jisu does not.
-- Order: A0 -> A1 -> A2 -> V1..V3 -> K0 -> K1 -> K2 -> K3 -> probes R-*.
-- Both functions keep their signature (CREATE OR REPLACE) so no overload is created.
-- Keys go AFTER the functions: until content_dispatch_max_bytes_default exists, content_import refuses every import with
-- config_missing:content_dispatch_max_bytes_default (fail-closed, intended).
-- No revert block here on purpose (Supabase SQL Editor runs everything pasted). The original definitions are in
-- phase1_step3_rpc_2026-10-05.sql (3-3 and 3-15).


/* A0: before. Expect 2 rows. content_import: old_empty_channels_guard=true, has_dispatch_cap=false. dist_mark_posted: false,false. */
SELECT p.oid::regprocedure::text AS sig,
       (position('jsonb_array_length(p_payload -> ''channels'') = 0' in p.prosrc) > 0) AS old_empty_channels_guard,
       (position('content_dispatch_max_bytes_default' in p.prosrc) > 0) AS has_dispatch_cap,
       (position('from=' in p.prosrc) > 0) AS has_from_audit
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('content_import', 'dist_mark_posted')
ORDER BY 1;


/* A1: content_import. Changes vs 3-3: (1) empty channels allowed, (2) asset above import ceiling -> bytes_over_limit,
   (3) channel skipped_oversize uses the dispatch ceiling (kind_form -> form -> default), (4) dispatch default missing -> config_missing. */
CREATE OR REPLACE FUNCTION public.content_import(p_source text, p_payload jsonb) RETURNS jsonb
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
  v_txt text; v_lead int; v_cap bigint; v_dcap bigint;
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
  /* channels must be an array but MAY be empty: an empty allowed_platforms is a deliberate "site only" master (HQ 2026-10-05).
     The Node layer already rejects a missing or null allowed_platforms. */
  IF jsonb_typeof(p_payload -> 'assets') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload -> 'channels') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'payload_invalid:assets_or_channels';
  END IF;

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

  /* Dispatch ceiling (what the Vercel function can hold in memory), separate from the import ceiling above.
     Lookup: <kind>_<form> -> <form> -> default. The default row must exist even when a more specific key wins (fail-closed). */
  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_dispatch_max_bytes_default';
  IF v_txt IS NULL THEN RAISE EXCEPTION 'config_missing:content_dispatch_max_bytes_default'; END IF;
  IF v_txt !~ '^[1-9][0-9]{0,17}$' THEN RAISE EXCEPTION 'config_invalid:content_dispatch_max_bytes_default'; END IF;
  v_dcap := v_txt::bigint;
  SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_dispatch_max_bytes_' || v_kind || '_' || v_form;
  IF v_txt IS NULL THEN
    SELECT value INTO v_txt FROM public.platform_config WHERE key = 'content_dispatch_max_bytes_' || v_form;
  END IF;
  IF v_txt IS NOT NULL THEN
    IF v_txt !~ '^[1-9][0-9]{0,17}$' THEN RAISE EXCEPTION 'config_invalid:content_dispatch_max_bytes'; END IF;
    v_dcap := v_txt::bigint;
  END IF;

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
        /* Import ceiling: an asset above it is refused outright (before the presign is consumed). */
        IF v_bytes > v_cap THEN RAISE EXCEPTION 'bytes_over_limit'; END IF;
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
      ELSIF v_asset_bytes IS NOT NULL AND v_asset_bytes > v_dcap THEN v_chan_status := 'skipped_oversize';
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


/* A2: dist_mark_posted. A PERMANENT human-resolution path (also for outages), not a stopgap (Jenny2 2026-10-05).
   unknown/failed -> posted as before (URL optional). skipped_oversize / skipped_no_asset -> posted too, URL REQUIRED:
   we never sent it, so the URL is the only evidence that a person uploaded it.
   The log reason records the previous status, the URL and the actor; created_at is the time. */
CREATE OR REPLACE FUNCTION public.dist_mark_posted(p_dist_id uuid, p_external_url text, p_actor_id uuid, p_actor_email text) RETURNS jsonb
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
  IF p_external_url IS NOT NULL
     AND (p_external_url !~ '^https://[^[:space:]]+$' OR char_length(p_external_url) > 2000) THEN
    RAISE EXCEPTION 'url_invalid';
  END IF;

  SELECT * INTO v_d FROM public.content_distributions WHERE id = p_dist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_d.status NOT IN ('unknown', 'failed', 'skipped_oversize', 'skipped_no_asset') THEN
    RAISE EXCEPTION 'invalid_transition:%->posted', v_d.status;
  END IF;
  IF v_d.status IN ('skipped_oversize', 'skipped_no_asset') AND p_external_url IS NULL THEN
    RAISE EXCEPTION 'url_required';
  END IF;

  UPDATE public.content_distributions
     SET status = 'posted', external_url = coalesce(p_external_url, external_url),
         published_at = now(), next_attempt_at = NULL, claimed_at = NULL
   WHERE id = v_d.id;

  INSERT INTO public.content_publish_log (content_id, platform, attempt_no, result, reason)
  VALUES (v_d.content_id, v_d.platform, NULL, 'manual_resolved',
          'marked posted from=' || v_d.status || ' url=' || coalesce(p_external_url, '-') || ' by ' || p_actor_email);

  RETURN jsonb_build_object('dist_id', v_d.id, 'status', 'posted', 'from', v_d.status);
END;
$fn_dist_mark_posted$;


/* V1: after A1+A2. Expect 2 rows. content_import: old_empty_channels_guard=false, has_dispatch_cap=true, has_from_audit=false.
   dist_mark_posted: false, false, has_from_audit=true. */
SELECT p.oid::regprocedure::text AS sig,
       (position('jsonb_array_length(p_payload -> ''channels'') = 0' in p.prosrc) > 0) AS old_empty_channels_guard,
       (position('content_dispatch_max_bytes_default' in p.prosrc) > 0) AS has_dispatch_cap,
       (position('from=' in p.prosrc) > 0) AS has_from_audit
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('content_import', 'dist_mark_posted')
ORDER BY 1;


/* V2: exactly 15 rows, no duplicate signatures (overload check). */
SELECT p.oid::regprocedure::text AS sig, p.prosecdef, p.proconfig::text
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(content|dist)_'
ORDER BY 1;


/* V3: EXECUTE grants. Expect 30 rows: postgres + service_role for each of the 15 functions, nobody else.
   CREATE OR REPLACE keeps the ACL; this proves it did. */
SELECT p.proname, coalesce(r.rolname, 'PUBLIC') AS grantee
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(p.proacl) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(content|dist)_'
ORDER BY p.proname, grantee;


/* K0: keys before. Control: content_max_bytes_default exists. Expect exactly 1 row (the control). */
SELECT key, value, value_type
FROM public.platform_config
WHERE key IN ('content_max_bytes_default', 'content_dispatch_max_bytes_default', 'content_max_bytes_film_full')
ORDER BY key;


/* K1: dispatch ceiling default 100MB (Jenny2/HQ 2026-10-05). Initial safety value for the current Vercel memory model,
   not a content standard. trailer / long / full keys are deliberately NOT created: unknown numbers are not pre-set;
   they fall back to this default. */
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_dispatch_max_bytes_default', '104857600', 'int',
  'Max asset bytes the dispatcher will download and send (the function holds the whole file in memory). Above it a channel is skipped_oversize. Lookup: content_dispatch_max_bytes_<kind>_<form>, then _<form>, then this default. Missing = import refused (503).',
  '송출 시 내려받아 보낼 수 있는 에셋 최대 바이트(함수가 파일 전체를 메모리에 올림). 초과 시 해당 채널 skipped_oversize. 조회 순서: <kind>_<form> -> <form> -> 이 기본값. 행이 없으면 수입 거절.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


/* K2: import ceiling for film/full 10GB. Initial safety ceiling, not a typical size; the first real feature will tell. */
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_max_bytes_film_full', '10737418240', 'int',
  'Import ceiling in bytes for kind=film form=full. Initial safety ceiling, not a typical size. Assets above it are refused at import.',
  'film/full 수입 상한(바이트). 초기 안전 상한이며 일반 크기가 아님. 초과 에셋은 수입 거절.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


/* K3: keys after. Expect 3 rows; has_ws false everywhere. */
SELECT key, value, value_type, (value ~ '\s' OR key ~ '\s') AS has_ws
FROM public.platform_config
WHERE key IN ('content_max_bytes_default', 'content_dispatch_max_bytes_default', 'content_max_bytes_film_full')
ORDER BY key;


/* =========================================================================
   LIVE RE-PROBES. Run in order. Probe rows stay forever. All restricted, so none can ever be sent.
   The presigns use 3 of the 20 hourly issues allowed per source.
   ========================================================================= */

/* R-1a (run once): A main_9x16 1000 bytes. Expect {key, expires_at}. */
SELECT public.content_presign('news_desk', 'probe-redef-a-20261005', 1, 'main_9x16', 1000, 'video/mp4');

/* R-1b (run once): B main_16x9 200000000 bytes (above the 100MB dispatch default, below the 500MB import default). */
SELECT public.content_presign('news_desk', 'probe-redef-b-20261005', 1, 'main_16x9', 200000000, 'video/mp4');

/* R-1c (run once): B thumbnail 1000 bytes. */
SELECT public.content_presign('news_desk', 'probe-redef-b-20261005', 1, 'thumbnail', 1000, 'image/jpeg');


/* R-2: A = EMPTY channels (site-only master). Expect outcome=created, status=held, channels null. */
SELECT public.content_import('news_desk', jsonb_build_object(
  'source_ref', 'probe-redef-a-20261005', 'source_version', 1, 'kind', 'news', 'form', 'short', 'language', 'ko',
  'rights_status', 'restricted', 'rights_reason', 'redefine probe A, never sendable',
  'title', 'probe redef a', 'description', NULL, 'caption', NULL,
  'upstream_approved_by', 'probe', 'upstream_approved_at', to_jsonb(now()),
  'upstream_approval_id', 'probe-redef-a-approval-20261005', 'ai_generated', true,
  'payload_hash', 'probe-redef-a-hash-1', 'publish_at', to_jsonb(now() + interval '1 day'), 'late_for_slot', false,
  'assets', jsonb_build_array(jsonb_build_object(
      'role', 'main_9x16', 'media_type', 'video',
      'key', (SELECT key FROM public.content_presigns WHERE source_ref = 'probe-redef-a-20261005' AND role = 'main_9x16' LIMIT 1),
      'url', 'https://probe.invalid/a.mp4', 'file_format', 'mp4', 'bytes', 1000, 'sha256', repeat('0', 64))),
  'channels', '[]'::jsonb
));

/* R-2b: A has no distribution rows. Expect dist_rows = 0. */
SELECT count(*) AS dist_rows FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-a-20261005';

/* R-3: B = 3 channels, asset 200MB. Expect created; youtube skipped_oversize, instagram skipped_no_asset, tiktok queued. */
SELECT public.content_import('news_desk', jsonb_build_object(
  'source_ref', 'probe-redef-b-20261005', 'source_version', 1, 'kind', 'news', 'form', 'short', 'language', 'ko',
  'rights_status', 'restricted', 'rights_reason', 'redefine probe B, never sendable',
  'title', 'probe redef b', 'description', NULL, 'caption', NULL,
  'upstream_approved_by', 'probe', 'upstream_approved_at', to_jsonb(now()),
  'upstream_approval_id', 'probe-redef-b-approval-20261005', 'ai_generated', true,
  'payload_hash', 'probe-redef-b-hash-1', 'publish_at', to_jsonb(now() + interval '1 day'), 'late_for_slot', false,
  'assets', jsonb_build_array(
    jsonb_build_object('role', 'main_16x9', 'media_type', 'video',
      'key', (SELECT key FROM public.content_presigns WHERE source_ref = 'probe-redef-b-20261005' AND role = 'main_16x9' LIMIT 1),
      'url', 'https://probe.invalid/b.mp4', 'file_format', 'mp4', 'bytes', 200000000, 'sha256', repeat('0', 64)),
    jsonb_build_object('role', 'thumbnail', 'media_type', 'image',
      'key', (SELECT key FROM public.content_presigns WHERE source_ref = 'probe-redef-b-20261005' AND role = 'thumbnail' LIMIT 1),
      'url', 'https://probe.invalid/b.jpg', 'file_format', 'jpg', 'bytes', 1000, 'sha256', repeat('1', 64))),
  'channels', jsonb_build_array(
    jsonb_build_object('platform', 'youtube', 'role', 'main_16x9'),
    jsonb_build_object('platform', 'instagram', 'role', 'main_9x16'),
    jsonb_build_object('platform', 'tiktok', 'role', 'thumbnail'))
));

/* R-4: asset above the IMPORT ceiling (600MB > 500MB default). Expect ERROR bytes_over_limit. Nothing is written. */
SELECT public.content_import('news_desk', jsonb_build_object(
  'source_ref', 'probe-redef-c-20261005', 'source_version', 1, 'kind', 'news', 'form', 'short', 'language', 'ko',
  'rights_status', 'restricted', 'rights_reason', 'redefine probe C, over import ceiling',
  'title', 'probe redef c', 'description', NULL, 'caption', NULL,
  'upstream_approved_by', 'probe', 'upstream_approved_at', to_jsonb(now()),
  'upstream_approval_id', 'probe-redef-c-approval-20261005', 'ai_generated', true,
  'payload_hash', 'probe-redef-c-hash-1', 'publish_at', to_jsonb(now() + interval '1 day'), 'late_for_slot', false,
  'assets', jsonb_build_array(jsonb_build_object('role', 'main_16x9', 'media_type', 'video',
      'key', 'imports/news_desk/probe-redef-c-20261005/v1/main_16x9-x', 'url', 'https://probe.invalid/c.mp4',
      'file_format', 'mp4', 'bytes', 600000000, 'sha256', repeat('0', 64))),
  'channels', jsonb_build_array(jsonb_build_object('platform', 'youtube', 'role', 'main_16x9'))
));

/* R-4b: after R-4. Expect 0 rows. */
SELECT c.id FROM public.contents c WHERE c.source_ref = 'probe-redef-c-20261005';

/* R-5: B channels as stored. Expect youtube skipped_oversize, instagram skipped_no_asset, tiktok queued. */
SELECT d.platform, d.status FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' ORDER BY d.platform;

/* R-6: skipped_oversize without URL. Expect ERROR url_required. */
SELECT public.dist_mark_posted(d.id, NULL, NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'youtube';

/* R-7: http, not https. Expect ERROR url_invalid. */
SELECT public.dist_mark_posted(d.id, 'http://probe.invalid/x', NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'youtube';

/* R-8: skipped_oversize with URL. Expect status=posted, from=skipped_oversize. */
SELECT public.dist_mark_posted(d.id, 'https://probe.invalid/oversize', NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'youtube';

/* R-9: skipped_no_asset without URL. Expect ERROR url_required. */
SELECT public.dist_mark_posted(d.id, NULL, NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'instagram';

/* R-10: skipped_no_asset with URL. Expect status=posted, from=skipped_no_asset. */
SELECT public.dist_mark_posted(d.id, 'https://probe.invalid/noasset', NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'instagram';

/* R-11: control, a row already posted must still refuse. Expect ERROR invalid_transition:posted->posted. */
SELECT public.dist_mark_posted(d.id, 'https://probe.invalid/again', NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'youtube';

/* R-12a: regression for the unchanged path. Put the queued tiktok probe row into unknown by hand. Expect 1 row. */
UPDATE public.content_distributions d SET status = 'unknown'
FROM public.contents c WHERE d.content_id = c.id AND c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'tiktok'
RETURNING d.id, d.status;

/* R-12b: unknown -> posted WITHOUT a URL still works. Expect status=posted, from=unknown. */
SELECT public.dist_mark_posted(d.id, NULL, NULL, 'probe@oxxovo')
FROM public.content_distributions d JOIN public.contents c ON c.id = d.content_id
WHERE c.source_ref = 'probe-redef-b-20261005' AND d.platform = 'tiktok';

/* R-13: the trail. Expect 3 rows, result manual_resolved, reasons containing from=skipped_oversize,
   from=skipped_no_asset and from=unknown, plus the URL and probe@oxxovo. */
SELECT l.platform, l.result, l.reason, l.created_at
FROM public.content_publish_log l JOIN public.contents c ON c.id = l.content_id
WHERE c.source_ref = 'probe-redef-b-20261005'
ORDER BY l.created_at, l.platform;
