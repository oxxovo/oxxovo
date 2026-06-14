BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_compose_min_seconds int NOT NULL DEFAULT 15;

ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_compose_len_chk;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_compose_len_chk
    CHECK (studio_compose_min_seconds >= 1
       AND studio_compose_max_seconds >= studio_compose_min_seconds);

UPDATE public.seasons
SET studio_compose_min_seconds = 15,
    studio_compose_max_seconds = 30,
    updated_at = now()
WHERE id = 'season_0';

COMMIT;

SELECT id, studio_compose_enabled,
       studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips,
       application_video_min_seconds, application_video_max_seconds,
       main_round_video_min_seconds, main_round_video_max_seconds
FROM public.seasons WHERE id = 'season_0';
