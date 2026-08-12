SELECT id, name, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips FROM seasons ORDER BY id;

UPDATE seasons SET studio_compose_min_seconds = 30, studio_compose_max_seconds = 40
WHERE id = 'season_0'
RETURNING id, name, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips;
