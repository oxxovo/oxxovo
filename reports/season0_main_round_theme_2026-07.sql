SELECT id, name, main_round_theme FROM seasons ORDER BY id;

UPDATE seasons SET main_round_theme = $OXX$OXXOVO Season 0 — Competition Theme: Cosmetic Commercial Film
Mission: Create a 30–40 second premium cosmetic commercial using AI. Your film must include a scene where lotion or serum is applied to a person's face. The product must be clearly visible on screen through its color or texture. (Transparent or visually unidentifiable products are not allowed.)
Requirements:
- Length: 30–40 seconds
- AI-generated content only
- A scene showing lotion or serum being applied to the face is required
- The product must be clearly identifiable on screen through its color or texture
- The final film should meet the visual quality expected of a premium cosmetic commercial
Evaluation — Core Skills Assessed:
Character Consistency / Natural Hand–Face Interaction / Lotion·Serum Texture & Material Realism / Camera Direction & Cinematography / Storytelling / Product Presentation / Overall Commercial Quality$OXX$
WHERE id = 'season_0'
RETURNING id, name, char_length(main_round_theme) AS theme_chars, main_round_theme;
