SELECT id, char_length(main_round_theme) AS theme_chars,
       length(main_round_theme) - length(replace(main_round_theme, chr(13), '')) AS cr_count
FROM seasons WHERE id = 'season_0';

UPDATE seasons SET main_round_theme = replace(main_round_theme, chr(13), '')
WHERE id = 'season_0'
RETURNING id, char_length(main_round_theme) AS theme_chars,
          length(main_round_theme) - length(replace(main_round_theme, chr(13), '')) AS cr_count;
