SELECT id, name, season_theme, main_round_theme, main_round_theme_label FROM seasons WHERE id = 'season_test';

UPDATE seasons SET main_round_theme_label = 'OXXOVO Beauty CF'
WHERE id = 'season_test'
RETURNING id, name, season_theme, main_round_theme, main_round_theme_label;
