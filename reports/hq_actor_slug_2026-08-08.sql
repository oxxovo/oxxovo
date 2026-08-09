-- =========================================================================
-- HQ item (3) -- official_actors slug: actor-3-beauty-cf -> rin.
-- File 2 of 2. Separate from hq_ddl_music_seasons_2026-08-08.sql as ordered.
-- 2026-08-08, jisu (main). ASCII only. LF only.
--
-- -------------------------------------------------------------------------
-- READ THIS BEFORE RUNNING ANYTHING. The slug is one of SIX places that carry
-- the theme, and it is the only one this file can reach. Measured 2026-08-08:
--
--   slug                   actor-3-beauty-cf         <- "beauty", "cf"
--   canonical_frontal_url  .../official_actors/actor-3-beauty-cf/frontal.jpg
--   reference_urls[4]      same path, four angles
--   R2 object keys         same path -- and the bucket is PUBLIC:
--                          HEAD on all five objects returned 200 with no auth
--   provenance (jsonb)     "beauty campaign", "cosmetics advertisement",
--                          "lipstick", plus the clip path
--   cryptobind_signature   signed OVER the slug and the four URLs
--
-- Two consequences, both measured rather than argued:
--
--   1. A slug-only UPDATE does not close the leak. The rendered page for item
--      (7) shows canonical_frontal_url, and that string still spells out the
--      theme. Renaming the row would move the label and leave the sign up.
--
--   2. A slug-only UPDATE actively BREAKS something. The v1actor canonical is
--        v1actor|<slug>|<frontal_url>|<sorted refs>|<sha256(provenance)>
--      so changing the slug without re-signing leaves a signature that no
--      longer verifies -- and that signature is the only thing that proves the
--      actor's canonical set was not altered. Verified today that the STORED
--      signature does reproduce from this secret, so it is currently good; the
--      new values below were computed the same way and were produced by
--      scripts/actor-rename-plan.mjs, not typed by hand.
--
-- So the order is: move the objects, then move the row. STEP 0 is not optional
-- -- run BLOCK 2 first and the four public URLs 404 (measured: new path is 404
-- on all five today).
--
-- provenance is deliberately NOT rewritten. It is the archival record of how
-- this actor was generated, its hash is inside the signature, and editing it to
-- remove the word "cosmetics" would be falsifying provenance to win a naming
-- argument. It is server-side only: nothing in either repo reads
-- official_actors except the three onboarding scripts (measured: 0 other hits).
-- The consistency_i2v.mp4 named inside it also stays where it is.
--
-- -------------------------------------------------------------------------
-- STEP 0 -- NOT SQL. Copy the four public angles in R2 to the new prefix.
--   official_actors/actor-3-beauty-cf/{frontal,three_quarter_left,
--                                      three_quarter_right,profile}.jpg
--   -> official_actors/rin/<same>
-- Copy, not move: the old objects stay until BLOCK 3 confirms the new ones
-- serve, and their removal is a separate decision because deleting a public
-- object is the one step here that cannot be undone from this side.
-- R2 credentials live in oxxovo-studio/.env, so this runs from that repo.
-- I have prepared it and have NOT run it -- awaiting the go.
-- =========================================================================


-- =========================================================================
-- BLOCK 1 -- CONFIRM. Run alone. Expect exactly:
--   n_actors = 1, slug = 'actor-3-beauty-cf', display_name = 'RIN',
--   status = 'draft', n_refs = 4, slug_is_unique = true, n_referencing_fks = 0
-- If slug_is_unique is false the UPDATE below is still safe (it is keyed on id)
-- but the rename would not be protected against a duplicate, so report it.
-- If n_referencing_fks is not 0, STOP: another table points at this row and
-- this file does not know about it.
-- =========================================================================
SELECT
  (SELECT count(*) FROM public.official_actors)                                AS n_actors,
  (SELECT slug FROM public.official_actors LIMIT 1)                            AS slug,
  (SELECT display_name FROM public.official_actors LIMIT 1)                    AS display_name,
  (SELECT status FROM public.official_actors LIMIT 1)                          AS status,
  (SELECT cardinality(reference_urls) FROM public.official_actors LIMIT 1)     AS n_refs,
  EXISTS (SELECT 1 FROM pg_constraint c
            WHERE c.conrelid = 'public.official_actors'::regclass
              AND c.contype IN ('u','p')
              AND (SELECT array_agg(a.attname ORDER BY a.attname)
                     FROM unnest(c.conkey) k
                     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
                  = ARRAY['slug'])                                             AS slug_is_unique,
  (SELECT count(*) FROM pg_constraint
     WHERE confrelid = 'public.official_actors'::regclass AND contype = 'f')   AS n_referencing_fks;


-- =========================================================================
-- BLOCK 2 -- WRITE. Run ONLY after STEP 0 has been done and BLOCK 1 matched.
--
-- Keyed on id AND the old slug, so a second run affects 0 rows instead of
-- re-signing something already renamed. Expect EXACTLY 1 row back; 0 rows means
-- the rename already happened (or BLOCK 1 did not match) -- either way, stop
-- and read BLOCK 3 rather than editing this.
--
-- cryptobind_hash / cryptobind_signature are the recomputed v1actor values for
-- the new slug and the new URLs, over the UNCHANGED provenance hash.
-- cryptobind_algo does not change: the algorithm is the same, only the input.
-- =========================================================================
UPDATE public.official_actors
   SET slug                  = 'rin',
       canonical_frontal_url = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/official_actors/rin/frontal.jpg',
       reference_urls        = ARRAY[
         'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/official_actors/rin/frontal.jpg',
         'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/official_actors/rin/three_quarter_left.jpg',
         'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/official_actors/rin/three_quarter_right.jpg',
         'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/official_actors/rin/profile.jpg'
       ],
       cryptobind_hash       = '0d56eecf8d942c30cdef1d534f32ff43a2658989c7bbb5812a455c6f533ea99c',
       cryptobind_signature  = '9d0c143f6b4857ebafdcdaba0f498fb87ae4cbad31a7d773b7ed7b1cfa2de1d3',
       updated_at            = now()
 WHERE id   = 'fa0cda94-9736-4df4-bcfa-af6b0622ebad'
   AND slug = 'actor-3-beauty-cf'
RETURNING id, slug, display_name, status, canonical_frontal_url, cryptobind_algo;


-- =========================================================================
-- BLOCK 3 -- VERIFY. Expect:
--   slug = 'rin', status = 'draft' (unchanged -- this rename does not expose
--   anything), n_refs = 4, theme_words_in_urls = 0, old_path_left = 0.
--
-- theme_words_in_urls is the actual test: it looks for the leaking strings in
-- the two URL columns rather than trusting that the slug was the only place
-- they lived. provenance is excluded on purpose -- see the header.
-- =========================================================================
SELECT
  slug,
  display_name,
  status,
  cardinality(reference_urls) AS n_refs,
  (CASE WHEN canonical_frontal_url ~* '(beauty|cosmetic|lipstick|campaign|advertis|-cf)' THEN 1 ELSE 0 END)
  + (SELECT count(*) FROM unnest(reference_urls) u
       WHERE u ~* '(beauty|cosmetic|lipstick|campaign|advertis|-cf)')          AS theme_words_in_urls,
  (CASE WHEN canonical_frontal_url LIKE '%actor-3-beauty-cf%' THEN 1 ELSE 0 END)
  + (SELECT count(*) FROM unnest(reference_urls) u
       WHERE u LIKE '%actor-3-beauty-cf%')                                     AS old_path_left,
  (SELECT count(*) FROM unnest(reference_urls) u WHERE u ~ '\s')               AS whitespace_in_urls
FROM public.official_actors
WHERE id = 'fa0cda94-9736-4df4-bcfa-af6b0622ebad';


-- =========================================================================
-- BLOCK 4 -- AFTER BLOCK 3 PASSES, and not before: re-verify the signature.
-- This is not SQL -- HMAC over a recursively key-sorted jsonb serialization is
-- not something to reimplement in the SQL editor. Run from the app repo:
--
--   node --env-file=.env.local scripts/actor-rename-plan.mjs
--
-- With the rename applied it will report "no official_actors row with
-- slug=actor-3-beauty-cf", which is itself the confirmation the row moved.
-- To check the NEW signature verifies, run it with the slugs swapped:
--
--   OLD_ACTOR_SLUG=rin node --env-file=.env.local scripts/actor-rename-plan.mjs
--
-- and read section 2: both "match" lines must be true. If either is false the
-- row is signed with something that is not its own contents, and item (7) must
-- not expose it until that is resolved.
-- =========================================================================


-- =========================================================================
-- STILL OPEN after this file -- the old public objects.
-- official_actors/actor-3-beauty-cf/*.jpg keep returning 200 to anyone who
-- knows the path. The path is not guessable and the bucket does not list, so
-- the exposure is small, but it is not zero and it is exactly the string the
-- rename exists to remove. Deleting five public objects is irreversible from
-- this side, so it is a separate instruction rather than a step hidden at the
-- bottom of a migration.
-- =========================================================================
