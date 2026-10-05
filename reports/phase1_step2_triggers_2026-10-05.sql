-- =========================================================================
-- Phase 1 STEP 2 -- audit, immutability, append-only, alerted_at reset triggers
-- (design: reports/phase1_design_2026-10-04.md, final k)
--
-- STATUS: RUN by TK on 2026-10-05, all blocks passed (V1..V3 and P1..P11 verified live).
-- This file is a record of what was Run, not something to Run again.
--
-- Decisions made while writing this step (not in the design text, see design
-- section 6 follow-ups):
--   * contents audit logs INSERT too (imports start as held, so UPDATE-only
--     audit would leave contents_history empty -- same shape as the 10-03
--     platform_config_history 0-row incident)
--   * TRUNCATE is rejected by statement-level triggers (row-level DELETE
--     triggers do not fire on TRUNCATE, and service_role holds TRUNCATE)
--   * id and created_at are immutable on contents (contents_history has no FK)
--   * trigger functions are named trg_* so the step-3 read-back of
--     proname ~ '^(content|dist)_' stays at exactly 15 rows
--   * trigger functions are SECURITY INVOKER so current_user distinguishes
--     db:service_role from db:postgres; actor comes from
--     set_config('app.actor_email'/'app.actor_id', ..., true) when the caller sets it
-- =========================================================================

-- B0a: NOT NULL state of the audit table. Expect content_id/field/id/changed_at NO, other 4 YES (8 rows).
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contents_history'
ORDER BY ordinal_position;


-- B0b: user triggers must be 0 on all 6 tables. internal_triggers (FK) is the control.
SELECT c.relname,
       count(t.oid) FILTER (WHERE NOT t.tgisinternal) AS user_triggers,
       count(t.oid) FILTER (WHERE t.tgisinternal) AS internal_triggers
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_trigger t ON t.tgrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('contents', 'content_assets', 'content_distributions', 'content_presigns',
                    'content_publish_log', 'contents_history')
GROUP BY c.relname
ORDER BY c.relname;


-- B0c: trg_* names must be free. Control: platform_config_audit must show up (expect exactly 1 row).
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (proname ~ '^trg_' OR proname = 'platform_config_audit')
ORDER BY proname;


-- S1: generic reject function used by the append-only / no-delete triggers
CREATE FUNCTION public.trg_reject_mutation() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed (immutable / append-only table)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_reject_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_reject_mutation() TO service_role;


-- S2: contents audit (INSERT and UPDATE, 9 fields). Actor from app.actor_* settings, else db:<current_user>.
CREATE FUNCTION public.trg_contents_audit() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  f       text;
  v_old   text;
  v_new   text;
  v_email text;
  v_id    uuid;
BEGIN
  v_email := coalesce(nullif(current_setting('app.actor_email', true), ''), 'db:' || current_user);
  v_id := CASE WHEN current_setting('app.actor_id', true) ~ '^[0-9a-fA-F-]{36}$'
               THEN current_setting('app.actor_id', true)::uuid ELSE NULL END;

  FOREACH f IN ARRAY ARRAY['status', 'rights_status', 'rights_reason', 'publish_at', 'title',
                           'description', 'caption', 'returned_reason', 'held_reason']
  LOOP
    v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) ->> f END;
    v_new := to_jsonb(NEW) ->> f;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.contents_history (content_id, field, old_value, new_value, changed_by, changed_by_email)
      VALUES (NEW.id, f, v_old, v_new, v_id, v_email);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_contents_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_contents_audit() TO service_role;

CREATE TRIGGER contents_audit_trg
  AFTER INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.trg_contents_audit();


-- S3: contents updated_at touch
CREATE FUNCTION public.trg_contents_touch() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_contents_touch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_contents_touch() TO service_role;

CREATE TRIGGER contents_touch_trg
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.trg_contents_touch();


-- S4: contents immutable columns + rights_status may only go down (cleared -> restricted -> blocked)
CREATE FUNCTION public.trg_contents_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  f          text;
  v_old_rank int;
  v_new_rank int;
BEGIN
  FOREACH f IN ARRAY ARRAY['id', 'source', 'source_ref', 'source_version', 'kind',
                           'upstream_approved_by', 'upstream_approved_at', 'upstream_approval_id',
                           'payload_hash', 'language', 'form', 'ai_generated', 'created_at']
  LOOP
    IF (to_jsonb(NEW) -> f) IS DISTINCT FROM (to_jsonb(OLD) -> f) THEN
      RAISE EXCEPTION 'contents.% is immutable (a change means a new version)', f
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END LOOP;

  v_old_rank := CASE OLD.rights_status WHEN 'cleared' THEN 0 WHEN 'restricted' THEN 1 WHEN 'blocked' THEN 2 END;
  v_new_rank := CASE NEW.rights_status WHEN 'cleared' THEN 0 WHEN 'restricted' THEN 1 WHEN 'blocked' THEN 2 END;
  IF v_new_rank < v_old_rank THEN
    RAISE EXCEPTION 'contents.rights_status may only go down (% -> %); raising it needs a new version',
      OLD.rights_status, NEW.rights_status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_contents_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_contents_guard() TO service_role;

CREATE TRIGGER contents_guard_trg
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.trg_contents_guard();


-- S5: contents cannot be deleted or truncated (hide with status='hidden')
CREATE TRIGGER contents_no_delete_trg
  BEFORE DELETE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.trg_reject_mutation();

CREATE TRIGGER contents_no_truncate_trg
  BEFORE TRUNCATE ON public.contents
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reject_mutation();


-- S6: content_assets immutable (no UPDATE, DELETE, TRUNCATE)
CREATE TRIGGER content_assets_immutable_trg
  BEFORE UPDATE OR DELETE ON public.content_assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_reject_mutation();

CREATE TRIGGER content_assets_no_truncate_trg
  BEFORE TRUNCATE ON public.content_assets
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reject_mutation();


-- S7: content_distributions.alerted_at resets to NULL whenever status changes (any path)
CREATE FUNCTION public.trg_dist_alert_reset() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.alerted_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_dist_alert_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_dist_alert_reset() TO service_role;

CREATE TRIGGER content_distributions_alert_reset_trg
  BEFORE UPDATE ON public.content_distributions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_dist_alert_reset();


-- S8: contents_history append-only
CREATE TRIGGER contents_history_append_only_trg
  BEFORE UPDATE OR DELETE ON public.contents_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_reject_mutation();

CREATE TRIGGER contents_history_no_truncate_trg
  BEFORE TRUNCATE ON public.contents_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reject_mutation();


-- S9: content_publish_log append-only
CREATE TRIGGER content_publish_log_append_only_trg
  BEFORE UPDATE OR DELETE ON public.content_publish_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_reject_mutation();

CREATE TRIGGER content_publish_log_no_truncate_trg
  BEFORE TRUNCATE ON public.content_publish_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reject_mutation();


-- V1: user triggers. Expect 12 rows, tgenabled = O on all.
SELECT c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('contents', 'content_assets', 'content_distributions', 'content_presigns',
                    'content_publish_log', 'contents_history')
ORDER BY c.relname, t.tgname;


-- V2: trg_* functions. Expect exactly 5 rows; prosecdef false; search_path set; no anon/authenticated/PUBLIC in proacl.
SELECT p.oid::regprocedure::text AS sig, p.prosecdef, p.proacl::text, p.proconfig::text
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(trg_|content_|dist_)'
ORDER BY 1;


-- V3: deploy gate still clean. Expect missing = 0.
SELECT count(*) AS missing FROM public.check_service_role_grants();


-- =========================================================================
-- LIVE PROBES (run once, in order). contents / content_assets / content_publish_log
-- rows cannot be deleted, so the probe rows below stay forever (probe- convention:
-- restricted only, closed as hidden at the end).
-- =========================================================================

-- P1: probe row, restricted + held (never sendable). Expect 1 row back.
INSERT INTO public.contents
  (kind, surface, source, source_ref, source_version, title, language, form, rights_status, status,
   publish_at, upstream_approved_by, upstream_approved_at, upstream_approval_id, ai_generated,
   payload_hash, rights_reason)
VALUES
  ('news', 'video', 'news_desk', 'probe-trg-20261005', 1, 'probe', 'ko', 'short', 'restricted', 'held',
   now() + interval '1 day', 'probe', now(), 'probe-approval-20261005', true,
   'probe', 'trigger probe, never sendable')
RETURNING id, status, rights_status, created_at, updated_at;


-- P2: history from the INSERT. Expect 5 rows (status, rights_status, rights_reason, publish_at, title), old_value NULL.
SELECT h.field, h.old_value, h.new_value, h.changed_by_email
FROM public.contents_history h
JOIN public.contents c ON c.id = h.content_id
WHERE c.source_ref = 'probe-trg-20261005'
ORDER BY h.field;


-- P3: title change. Expect touched = true; one more history row follows.
UPDATE public.contents SET title = 'probe 2' WHERE source_ref = 'probe-trg-20261005'
RETURNING title, created_at, updated_at, updated_at > created_at AS touched;


-- P4: expect ERROR "contents.kind is immutable (a change means a new version)"
UPDATE public.contents SET kind = 'film' WHERE source_ref = 'probe-trg-20261005' RETURNING id;


-- P5: expect ERROR "contents.rights_status may only go down (restricted -> cleared); ..."
UPDATE public.contents SET rights_status = 'cleared', rights_reason = NULL WHERE source_ref = 'probe-trg-20261005' RETURNING id;


-- P6: restricted -> blocked is allowed. Expect 1 row; audit logs rights_status.
UPDATE public.contents SET rights_status = 'blocked' WHERE source_ref = 'probe-trg-20261005' RETURNING rights_status;


-- P7: expect ERROR "DELETE on contents is not allowed (immutable / append-only table)"
DELETE FROM public.contents WHERE source_ref = 'probe-trg-20261005' RETURNING id;


-- P8a: probe distribution row with alerted_at set. Expect 1 row, alerted_at not null.
INSERT INTO public.content_distributions (content_id, platform, status, alerted_at)
SELECT id, 'x', 'unknown', now() FROM public.contents WHERE source_ref = 'probe-trg-20261005'
RETURNING id, status, alerted_at;

-- P8b: control, status unchanged. Expect alerted_at STILL NOT NULL (trigger must not over-fire).
UPDATE public.content_distributions d SET last_error = 'probe'
FROM public.contents c
WHERE d.content_id = c.id AND c.source_ref = 'probe-trg-20261005'
RETURNING d.status, d.alerted_at;

-- P8c: status changes. Expect alerted_at = NULL.
UPDATE public.content_distributions d SET status = 'cancelled'
FROM public.contents c
WHERE d.content_id = c.id AND c.source_ref = 'probe-trg-20261005'
RETURNING d.status, d.alerted_at;


-- P9a: probe asset (text only, no url). Expect 1 row. This row stays forever.
INSERT INTO public.content_assets (content_id, role, media_type, text_content)
SELECT id, 'script', 'text', 'probe' FROM public.contents WHERE source_ref = 'probe-trg-20261005'
RETURNING id, role;

-- P9b: expect ERROR "UPDATE on content_assets is not allowed (immutable / append-only table)"
UPDATE public.content_assets SET text_content = 'x' WHERE role = 'script' RETURNING id;

-- P9c: expect ERROR "DELETE on content_assets is not allowed ..."
DELETE FROM public.content_assets WHERE role = 'script' RETURNING id;

-- P9d: expect ERROR "TRUNCATE on content_assets is not allowed ..."
TRUNCATE public.content_assets;


-- P10a: expect ERROR "UPDATE on contents_history is not allowed ..."
UPDATE public.contents_history SET field = 'x' WHERE field = 'title' RETURNING id;

-- P10b: probe publish log row. Expect 1 row. This row stays forever.
INSERT INTO public.content_publish_log (content_id, platform, result, reason)
SELECT id, 'x', 'requeued', 'trigger probe' FROM public.contents WHERE source_ref = 'probe-trg-20261005'
RETURNING id, result;

-- P10c: expect ERROR "UPDATE on content_publish_log is not allowed ..."
UPDATE public.content_publish_log SET reason = 'x' WHERE reason = 'trigger probe' RETURNING id;


-- P11a: close the probe row as hidden. Expect 1 row.
UPDATE public.contents SET status = 'hidden' WHERE source_ref = 'probe-trg-20261005' RETURNING status;

-- P11b: full probe history.
SELECT h.field, h.old_value, h.new_value, h.changed_by_email
FROM public.contents_history h
JOIN public.contents c ON c.id = h.content_id
WHERE c.source_ref = 'probe-trg-20261005'
ORDER BY h.changed_at, h.field;


-- =========================================================================
-- REVERT (do NOT run with the above). Probe rows stay in contents after a revert.
-- =========================================================================

-- D1: contents triggers
DROP TRIGGER IF EXISTS contents_audit_trg ON public.contents;
DROP TRIGGER IF EXISTS contents_touch_trg ON public.contents;
DROP TRIGGER IF EXISTS contents_guard_trg ON public.contents;
DROP TRIGGER IF EXISTS contents_no_delete_trg ON public.contents;
DROP TRIGGER IF EXISTS contents_no_truncate_trg ON public.contents;

-- D2: content_assets triggers
DROP TRIGGER IF EXISTS content_assets_immutable_trg ON public.content_assets;
DROP TRIGGER IF EXISTS content_assets_no_truncate_trg ON public.content_assets;

-- D3: content_distributions trigger
DROP TRIGGER IF EXISTS content_distributions_alert_reset_trg ON public.content_distributions;

-- D4: contents_history triggers
DROP TRIGGER IF EXISTS contents_history_append_only_trg ON public.contents_history;
DROP TRIGGER IF EXISTS contents_history_no_truncate_trg ON public.contents_history;

-- D5: content_publish_log triggers
DROP TRIGGER IF EXISTS content_publish_log_append_only_trg ON public.content_publish_log;
DROP TRIGGER IF EXISTS content_publish_log_no_truncate_trg ON public.content_publish_log;

-- D6: functions (only after D1..D5)
DROP FUNCTION IF EXISTS public.trg_contents_audit();
DROP FUNCTION IF EXISTS public.trg_contents_touch();
DROP FUNCTION IF EXISTS public.trg_contents_guard();
DROP FUNCTION IF EXISTS public.trg_dist_alert_reset();
DROP FUNCTION IF EXISTS public.trg_reject_mutation();
