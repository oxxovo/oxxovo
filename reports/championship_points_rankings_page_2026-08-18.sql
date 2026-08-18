-- Championship Points rankings info page (HQ 2026-08-18, 3rd pass).
-- Two new platform_config keys, both plain 'text'/'int' rows (no new
-- table/column) -- editable any time via /admin/settings (generic editor,
-- no code change needed to adjust either value later).

-- 1) Reveal date. PROVISIONAL VALUE -- the real instant depends on when
--    March 2027's last tournament actually ends, which is not scheduled
--    yet. Set to the start of April 2027 as a placeholder; update via
--    /admin/settings once that schedule is confirmed. The page only ever
--    displays this at month/year granularity ("2027년 3월"), never the
--    exact instant, so the placeholder's exact hour/minute does not show.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'championship_points_reveal_at',
  '2027-04-01T00:00:00Z',
  'text',
  'ISO instant after which the Championship Points ranking (top-500 + per-creator detail) is scheduled to go live. PROVISIONAL until March 2027''s tournament schedule is finalized -- update here when it is. Read by /watch/rankings; never hardcoded in code.',
  'Championship Points 랭킹(500등 목록 + 개별 상세)이 공개될 예정 시각(ISO). 2027년 3월 대회 일정이 확정되기 전까지는 잠정값 -- 확정되면 이 값을 갱신. /watch/rankings가 읽으며, 코드에 하드코딩하지 않음.'
)
ON CONFLICT (key) DO NOTHING
RETURNING key, value;

-- 2) Placeholder row count for the blank ranking table on /watch/rankings.
--    HQ: "줄 수는 더 많아도 된다" (more than the sidebar's fixed 3) -- 20
--    chosen as a middle ground, freely adjustable.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'championship_points_placeholder_rows',
  '20',
  'int',
  'Number of blank numbered rows shown on /watch/rankings while the real ranking is not yet live. Cosmetic only -- has no relation to the eventual top-500 list size.',
  '/watch/rankings에서 실제 랭킹 공개 전까지 보여줄 빈 번호 행의 개수. 순전히 화면용이며, 추후 실제 500등 목록 크기와는 무관.'
)
ON CONFLICT (key) DO NOTHING
RETURNING key, value;

-- Verify
SELECT key, value, value_type FROM public.platform_config
WHERE key IN ('championship_points_reveal_at', 'championship_points_placeholder_rows');
