-- Prompt-level IP/likeness check (HQ 2026-08-17 design). Additive only.
-- Existing generation_jobs rows are unaffected -- NULL means "checked before
-- this feature existed", not "cleared". MUST run before deploying
-- d793446 (lib/ip-check.ts) -- PostgREST rejects an INSERT that names an
-- unknown column, so every /studio generation would fail until this runs.

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS ip_check_status text,
  ADD COLUMN IF NOT EXISTS ip_check_note text;

ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_ip_check_status_chk
  CHECK (ip_check_status IS NULL OR ip_check_status IN ('clear', 'flagged', 'unchecked'));

-- Block threshold, NOT a code constant -- change the value any time via SQL or
-- admin, no redeploy needed. 'high' = only block unmistakable matches (named
-- character/brand/real person); 'medium'/'low' block progressively looser
-- matches. Below this level a prompt still gets ip_check_status='flagged' for
-- later review, but generation is not blocked.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'ip_check_block_confidence',
  'high',
  'text',
  'Confidence level (low/medium/high) at or above which the prompt IP/likeness check blocks a generation. Below this level the prompt is flagged (ip_check_status=flagged) but generation proceeds.',
  '프롬프트 IP/초상 검사가 생성을 차단하는 확신도 기준(low/medium/high). 이 값 미만이면 통과하되 ip_check_status=flagged로 표시만 남긴다.'
)
ON CONFLICT (key) DO NOTHING
RETURNING key, value;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'generation_jobs'
  AND column_name IN ('ip_check_status', 'ip_check_note');

SELECT key, value FROM public.platform_config WHERE key = 'ip_check_block_confidence';
