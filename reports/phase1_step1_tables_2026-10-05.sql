-- =========================================================================
-- Phase 1 STEP 1 -- tables, grants, RLS, platform_config keys
-- (design: reports/phase1_design_2026-10-04.md, final k)
--
-- STATUS: RUN by TK on 2026-10-05, all blocks passed (V1..V5 verified).
-- This file is a record of what was Run, not something to Run again.
-- Each block is one logical item; run one at a time in the Supabase SQL Editor.
-- Order: BLOCK 0a-0c (read-only) -> T1..T6 (FK order) -> C1..C12 -> V1..V5.
-- Revert: R0..R7 at the bottom. NEVER run them together with the above.
-- =========================================================================

-- BLOCK 0a: 6 tables must be absent. Controls: platform_config, genesis_applications, promo_videos present.
SELECT c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND c.relname IN ('contents', 'content_assets', 'content_distributions', 'content_presigns',
                    'content_publish_log', 'contents_history',
                    'platform_config', 'genesis_applications', 'promo_videos')
ORDER BY c.relname;
-- expect exactly 3 rows: genesis_applications, platform_config, promo_videos


-- BLOCK 0b: existing keys in the new namespaces. Control: competition_publication_enabled.
SELECT key, value, value_type
FROM public.platform_config
WHERE key ~ '^(content_|social_|news_|entertainment_)' OR key = 'competition_publication_enabled'
ORDER BY key;
-- expect exactly 2 rows: competition_publication_enabled, news_publication_enabled (both false)


-- BLOCK 0c: id types of the FK targets. Expect 2 rows, both uuid.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'id'
  AND table_name IN ('genesis_applications', 'promo_videos')
ORDER BY table_name;


-- T1: contents (table + indexes + grants + RLS in one block, per the deploy gate)
CREATE TABLE public.contents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                   text NOT NULL,
  surface                text NOT NULL,
  source                 text NOT NULL,
  source_ref             text NOT NULL,
  source_version         int  NOT NULL DEFAULT 1,
  title                  text NOT NULL,
  description            text,
  caption                text,
  language               text NOT NULL,
  form                   text NOT NULL,
  rights_status          text NOT NULL,
  status                 text NOT NULL,
  publish_at             timestamptz NOT NULL,
  upstream_approved_by   text NOT NULL,
  upstream_approved_at   timestamptz NOT NULL,
  upstream_approval_id   text NOT NULL,
  ai_generated           boolean NOT NULL,
  payload_hash           text NOT NULL,
  notified_at            timestamptz,
  held_reason            text,
  rights_reason          text,
  returned_reason        text,
  returned_by            uuid,
  returned_at            timestamptz,
  genesis_application_id uuid REFERENCES public.genesis_applications(id) ON DELETE RESTRICT,
  genesis_round          text,
  promo_video_id         uuid REFERENCES public.promo_videos(id) ON DELETE RESTRICT,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contents_source_ref_ver_uq UNIQUE (source, source_ref, source_version),
  CONSTRAINT contents_source_approval_uq UNIQUE (source, upstream_approval_id),
  CONSTRAINT contents_kind_chk          CHECK (kind IN ('news','drama','film','cf','music','music_video')),
  CONSTRAINT contents_surface_chk       CHECK (surface IN ('video')),
  CONSTRAINT contents_source_chk        CHECK (source IN ('news_desk','production_os')),
  CONSTRAINT contents_status_chk        CHECK (status IN ('scheduled','held','returned','hidden')),
  CONSTRAINT contents_rights_status_chk CHECK (rights_status IN ('cleared','restricted','blocked')),
  CONSTRAINT contents_language_chk      CHECK (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  CONSTRAINT contents_version_chk       CHECK (source_version >= 1),
  CONSTRAINT contents_scheduled_cleared_chk CHECK (status <> 'scheduled' OR rights_status = 'cleared'),
  CONSTRAINT contents_link_one_chk      CHECK (num_nonnulls(genesis_application_id, promo_video_id) <= 1),
  CONSTRAINT contents_genesis_pair_chk  CHECK ((genesis_application_id IS NULL) = (genesis_round IS NULL)),
  CONSTRAINT contents_returned_reason_chk CHECK (status <> 'returned' OR returned_reason IS NOT NULL),
  CONSTRAINT contents_held_reason_chk   CHECK (held_reason IS NULL OR held_reason IN ('late_for_slot','manual')),
  CONSTRAINT contents_rights_reason_chk CHECK (rights_status = 'cleared' OR rights_reason IS NOT NULL),
  CONSTRAINT contents_rights_reason_len_chk   CHECK (rights_reason IS NULL OR char_length(rights_reason) <= 2000),
  CONSTRAINT contents_returned_reason_len_chk CHECK (returned_reason IS NULL OR char_length(returned_reason) <= 2000)
);

CREATE INDEX contents_status_publish_idx ON public.contents (status, publish_at);
CREATE INDEX contents_returned_cursor_idx ON public.contents (returned_at, id) WHERE status = 'returned';

REVOKE ALL ON public.contents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contents TO service_role;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;


-- T2: content_assets
CREATE TABLE public.content_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  role         text NOT NULL,
  media_type   text NOT NULL,
  file_format  text,
  url          text,
  sha256       text,
  text_content text,
  duration_sec numeric,
  width        int,
  height       int,
  bytes        bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_assets_content_role_uq UNIQUE (content_id, role),
  CONSTRAINT content_assets_media_type_chk  CHECK (media_type IN ('video','audio','image','text')),
  CONSTRAINT content_assets_url_sha_chk     CHECK (url IS NULL OR sha256 IS NOT NULL),
  CONSTRAINT content_assets_text_len_chk    CHECK (text_content IS NULL OR octet_length(text_content) <= 65536)
);

REVOKE ALL ON public.content_assets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.content_assets TO service_role;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;


-- T3: content_distributions
CREATE TABLE public.content_distributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  platform        text NOT NULL,
  account         text,
  external_title  text,
  caption_sent    text,
  external_url    text,
  external_id     text,
  status          text NOT NULL,
  attempts        int  NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  alerted_at      timestamptz,
  last_error      text,
  scheduled_at    timestamptz,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_distributions_content_platform_uq UNIQUE (content_id, platform),
  CONSTRAINT content_distributions_platform_chk CHECK (platform IN ('youtube','instagram','tiktok','x')),
  CONSTRAINT content_distributions_status_chk   CHECK (status IN ('queued','sending','posted','failed','unknown','cancelled','skipped_no_asset','skipped_oversize')),
  CONSTRAINT content_distributions_attempts_chk CHECK (attempts >= 0)
);

CREATE INDEX content_distributions_claim_idx ON public.content_distributions (status, next_attempt_at);
CREATE INDEX content_distributions_alert_idx ON public.content_distributions (status) WHERE alerted_at IS NULL;

REVOKE ALL ON public.content_distributions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.content_distributions TO service_role;
ALTER TABLE public.content_distributions ENABLE ROW LEVEL SECURITY;


-- T4: content_presigns
CREATE TABLE public.content_presigns (
  key            text PRIMARY KEY,
  source         text NOT NULL,
  source_ref     text NOT NULL,
  source_version int  NOT NULL,
  role           text NOT NULL,
  bytes          bigint NOT NULL,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  consumed_at    timestamptz,
  CONSTRAINT content_presigns_source_chk  CHECK (source IN ('news_desk','production_os')),
  CONSTRAINT content_presigns_version_chk CHECK (source_version >= 1),
  CONSTRAINT content_presigns_bytes_chk   CHECK (bytes > 0)
);

CREATE INDEX content_presigns_rate_idx ON public.content_presigns (source, source_ref, created_at);
CREATE INDEX content_presigns_source_rate_idx ON public.content_presigns (source, created_at);
CREATE INDEX content_presigns_orphan_idx ON public.content_presigns (expires_at) WHERE consumed_at IS NULL;

REVOKE ALL ON public.content_presigns FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.content_presigns TO service_role;
ALTER TABLE public.content_presigns ENABLE ROW LEVEL SECURITY;


-- T5: content_publish_log (append-only trigger comes in step 2)
CREATE TABLE public.content_publish_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  platform    text NOT NULL,
  attempt_no  int,
  result      text NOT NULL,
  reason      text,
  http_status int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_publish_log_platform_chk CHECK (platform IN ('youtube','instagram','tiktok','x')),
  CONSTRAINT content_publish_log_result_chk   CHECK (result IN ('sent','failed','failed_terminal','unknown','stopped_by_switch','manual_resolved','requeued'))
);

CREATE INDEX content_publish_log_content_idx ON public.content_publish_log (content_id, created_at DESC);

REVOKE ALL ON public.content_publish_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.content_publish_log TO service_role;
ALTER TABLE public.content_publish_log ENABLE ROW LEVEL SECURITY;


-- T6: contents_history (no FK on purpose; append-only trigger comes in step 2)
CREATE TABLE public.contents_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       uuid NOT NULL,
  field            text NOT NULL,
  old_value        text,
  new_value        text,
  changed_by       uuid,
  changed_by_email text,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contents_history_content_idx ON public.contents_history (content_id, changed_at DESC);

REVOKE ALL ON public.contents_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contents_history TO service_role;
ALTER TABLE public.contents_history ENABLE ROW LEVEL SECURITY;


-- C1: master dispatch switch (promo + content). 'true' must exist before the promo guard deploys.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('social_dispatch_enabled', 'true', 'bool',
  'Master switch for everything sent through Postiz (promo and content). Fail-closed in code.',
  'Postiz로 나가는 전체 송출 마스터 스위치 (promo 포함).')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C2: news dispatch switch, closed.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('news_dispatch_enabled', 'false', 'bool',
  'News content SNS dispatch when true. Fail-closed in code.',
  '뉴스 콘텐츠 SNS 송출 여부.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C3: entertainment dispatch switch, closed.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('entertainment_dispatch_enabled', 'false', 'bool',
  'Entertainment content SNS dispatch when true. Fail-closed in code.',
  '엔터 콘텐츠 SNS 송출 여부.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C4: entertainment publication switch, closed. (news_publication_enabled already exists, not inserted.)
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('entertainment_publication_enabled', 'false', 'bool',
  'Entertainment content publicly visible when true. Independent of the other publication switches.',
  '엔터 콘텐츠 사이트 공개 여부. 다른 공개 스위치와 독립.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C5: news publish weekdays (English abbreviations only; anything else parses empty and stops news import).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('news_publish_weekdays', 'mon,tue,wed,thu,fri', 'text',
  'CSV weekday abbreviations (mon..sun) for the news publish slot. English abbreviations only.',
  '뉴스 발행 요일. 영문 약어만 허용 (mon,tue,...).')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C6: news publish time.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('news_publish_time', '07:00', 'text',
  'HH:MM 24h local time (in news_publish_timezone) of the news publish slot.',
  '뉴스 발행 시각 (news_publish_timezone 기준, HH:MM).')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C7: news publish timezone.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('news_publish_timezone', 'Asia/Seoul', 'text',
  'IANA timezone name for the news publish slot.',
  '뉴스 발행 시간대 (IANA 이름).')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C8: minimum lead before publish_at, minutes (TK 2026-10-05: 120).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_min_lead_minutes', '120', 'int',
  'publish_at floor: now() + this many minutes. Missing or invalid = import refused (503).',
  '발행 시각 최소 리드(분). 행이 없거나 이상하면 수입 거절.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C9: default max asset bytes (TK 2026-10-05: 500MB).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_max_bytes_default', '524288000', 'int',
  'Fallback max asset bytes when no content_max_bytes_<kind>_<form> key exists. Missing = import refused (503).',
  '에셋 최대 바이트 기본값. kind/form별 키가 없을 때 사용.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C10: dispatch rows per tick (TK 2026-10-05: 10).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_dispatch_per_tick', '10', 'int',
  'Max distribution rows processed per cron tick. Missing = 0 rows processed.',
  '크론 1회당 송출 처리 최대 건수. 행이 없으면 0건 처리.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C11: presign URL lifetime seconds (TK 2026-10-05: 3600).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_presign_ttl_seconds', '3600', 'int',
  'Lifetime of an issued presigned PUT URL. Missing or invalid = presign refused (503).',
  'presign PUT URL 유효 시간(초). 행이 없거나 이상하면 presign 거절.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- C12: presign issues per hour (TK 2026-10-05: 20).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES ('content_presign_rate_per_hour', '20', 'int',
  'Max presigns per hour, counted per source_ref and per source. Missing or invalid = presign refused (503).',
  '시간당 presign 발급 한도 (source_ref 단위 + source 전체 단위). 행이 없으면 거절.')
ON CONFLICT (key) DO NOTHING
RETURNING key, value, value_type, updated_at;


-- V1: who holds privileges on the 6 tables. Expect 12 rows: postgres + service_role per table, nobody else.
SELECT c.relname,
       coalesce(r.rolname, 'PUBLIC') AS grantee,
       string_agg(a.privilege_type, ',' ORDER BY a.privilege_type) AS privileges
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public'
  AND c.relname IN ('contents', 'content_assets', 'content_distributions', 'content_presigns',
                    'content_publish_log', 'contents_history')
GROUP BY c.relname, r.rolname
ORDER BY c.relname, grantee;


-- V2: RLS on, all 6 tables exist. Expect 6 rows, all true.
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('contents', 'content_assets', 'content_distributions', 'content_presigns',
                    'content_publish_log', 'contents_history')
ORDER BY c.relname;


-- V3: deploy:prod gate. Expect missing = 0.
SELECT count(*) AS missing FROM public.check_service_role_grants();


-- V4: constraints on the 6 tables for review.
SELECT conrelid::regclass::text AS tbl, conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid IN ('public.contents'::regclass, 'public.content_assets'::regclass,
                   'public.content_distributions'::regclass, 'public.content_presigns'::regclass,
                   'public.content_publish_log'::regclass, 'public.contents_history'::regclass)
ORDER BY 1, contype, conname;


-- V5a: new keys. Expect 13 rows (12 new + news_publication_enabled). has_ws_or_newline false everywhere.
SELECT key, value, value_type,
       (value ~ '\s' OR key ~ '\s'
        OR position(chr(10) in description) > 0 OR position(chr(13) in description) > 0
        OR position(chr(10) in coalesce(description_ko, '')) > 0) AS has_ws_or_newline
FROM public.platform_config
WHERE key ~ '^(content_|social_|news_|entertainment_)'
ORDER BY key;


-- V5b: audit trigger recorded the inserts. Expect 12 rows, changed_by_email = db:postgres.
SELECT key, field, old_value, new_value, changed_by_email
FROM public.platform_config_history
WHERE key ~ '^(content_|social_|news_|entertainment_)'
ORDER BY key;


-- =========================================================================
-- REVERT (do NOT run with the above). R0 first, then R1..R6 in order, then R7.
-- =========================================================================

-- R0: row counts. DROP loses data, so run this first. Expect all 0.
SELECT 'contents' AS t, count(*) FROM public.contents
UNION ALL SELECT 'content_assets', count(*) FROM public.content_assets
UNION ALL SELECT 'content_distributions', count(*) FROM public.content_distributions
UNION ALL SELECT 'content_presigns', count(*) FROM public.content_presigns
UNION ALL SELECT 'content_publish_log', count(*) FROM public.content_publish_log
UNION ALL SELECT 'contents_history', count(*) FROM public.contents_history;

-- R1
DROP TABLE public.content_publish_log;
-- R2
DROP TABLE public.content_distributions;
-- R3
DROP TABLE public.content_assets;
-- R4
DROP TABLE public.content_presigns;
-- R5
DROP TABLE public.contents_history;
-- R6 (last: the other tables reference it)
DROP TABLE public.contents;

-- R7: remove the 12 keys inserted by C1..C12. news_publication_enabled is NOT in this list (it pre-existed).
DELETE FROM public.platform_config
WHERE key IN ('social_dispatch_enabled', 'news_dispatch_enabled', 'entertainment_dispatch_enabled',
              'entertainment_publication_enabled', 'news_publish_weekdays', 'news_publish_time',
              'news_publish_timezone', 'content_min_lead_minutes', 'content_max_bytes_default',
              'content_dispatch_per_tick', 'content_presign_ttl_seconds', 'content_presign_rate_per_hour')
RETURNING key;
