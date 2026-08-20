-- ============================================================================
-- Nickname banned-word lists -- platform_config seed (제니3 2026-08-19, via 본부)
-- ============================================================================
-- Two keys, read by lib/nickname-banned-words.ts:
--   nickname_banned_words_general        word-boundary match (profanity/
--                                         sexual/hate -- substring matching
--                                         false-positives on real names/words
--                                         that merely contain a fragment)
--   nickname_banned_words_impersonation  substring match (impersonation of
--                                         staff/celebrities/companies, AI
--                                         actor names -- "OXXOVO_KIRA" must
--                                         be caught)
--
-- oxxovo/옥소보 are NOT in the impersonation list here -- they are a hardcoded
-- floor in code (lib/nickname-banned-words.ts IMPERSONATION_FLOOR), per 제니3's
-- own note excluding them from this seed.
--
-- "실명 유명인" (real celebrity names used alone) is a CATEGORY, not a literal
-- list -- 제니3 did not supply concrete names (an exhaustive celebrity-name
-- list is not enumerable), so nothing from that sub-category is seeded here.
-- Only the concrete company-name list and the concrete AI-actor names are.
--
-- ASCII-only in code/comments; the VALUES themselves are Korean/English words
-- verbatim, not escaped (this is stored data, not code -- see feedback from
-- earlier today: SQL comments/code stay ASCII, but a value that IS Korean
-- goes in as literal Korean).
--
-- Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'nickname_banned_words_general',
  '["시발","씨발","씨바","ㅅㅂ","좆","존나","병신","ㅂㅅ","지랄","개새끼","새끼","미친놈","미친년","니미","애미","닥쳐","꺼져","fuck","fuk","fck","shit","bitch","bastard","asshole","cunt","dick","pussy","whore","slut","retard","섹스","성인","야동","자지","보지","강간","몰카","노출","sex","sexy","porn","nude","naked","nsfw","hentai","rape","milf","bdsm","orgasm","한남","김치녀","짱깨","쪽바리","흑형","장애인","병신새끼","일베","메갈","nigger","nigga","chink","jap","gook","fag","faggot","tranny","nazi","hitler","kkk"]',
  'text',
  'Nickname banned-word list, WORD-BOUNDARY matched (lib/nickname-banned-words.ts matchesWholeWord). Profanity, sexual terms, hate/discrimination. 제니3 2026-08-19, via 본부.',
  '닉네임 금지어 목록(단어 경계 일치). 욕설·비속어, 성적 표현, 혐오·차별. 제니3 2026-08-19 원문, 본부 경유.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_type = EXCLUDED.value_type
RETURNING key, value_type;

INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'nickname_banned_words_impersonation',
  '["운영자","관리자","심사위원","심사","공식","어드민","고객센터","admin","administrator","official","staff","moderator","judge","support","system","root","google","apple","meta","openai","anthropic","netflix","disney","marvel","nintendo","samsung","sony","adobe","tiktok","youtube","instagram","KIRA","키라","ANNA","애나","RIN","린"]',
  'text',
  'Nickname banned-word list, SUBSTRING matched (lib/nickname-banned-words.ts matchesSubstring) -- deliberately looser than the general list so "OXXOVO_KIRA" is caught. Staff-title impersonation, company names, AI-actor names. oxxovo/옥소보 excluded here -- hardcoded floor in code instead. 제니3 2026-08-19, via 본부.',
  '닉네임 금지어 목록(포함 일치, 일반 목록보다 느슨하게 잡음 -- "OXXOVO_KIRA" 같은 것을 잡기 위함). 직위 사칭, 기업명, AI배우명. oxxovo/옥소보는 여기 없음 -- 코드에 하드 항목으로 이미 있음. 제니3 2026-08-19 원문, 본부 경유.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_type = EXCLUDED.value_type
RETURNING key, value_type;

COMMIT;

-- ============================================================================
-- Verification -- expect 2 rows, both value_type='text'
-- ============================================================================
SELECT key, value_type, jsonb_array_length(value::jsonb) AS word_count
FROM public.platform_config
WHERE key IN ('nickname_banned_words_general', 'nickname_banned_words_impersonation');
