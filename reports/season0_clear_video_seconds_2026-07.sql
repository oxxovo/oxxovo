SELECT id, name, main_round_video_seconds, studio_compose_min_seconds, studio_compose_max_seconds FROM seasons ORDER BY id;

ALTER TABLE public.seasons ALTER COLUMN main_round_video_seconds DROP NOT NULL;

UPDATE seasons SET main_round_video_seconds = NULL
WHERE id = 'season_0'
RETURNING id, name, main_round_video_seconds, studio_compose_min_seconds, studio_compose_max_seconds;
