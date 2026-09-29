-- genesis_applications.age -- new column (C-7, HQ 2026-08-23)
-- ============================================================================
-- Field only, no gate. The apply form (app/apply/page.tsx FunnelScreen) and
-- lib/studio.ts registerForSeason() are already wired to write this column --
-- run this before that code deploys, or every registration until then 400s
-- on PostgREST "column age does not exist".
--
-- No minimum-age ENFORCEMENT here or in code -- TK's call still pending (HQ
-- recommends 18). This only makes the value collectible now so enforcing a
-- floor later is a value check on existing data, not a schema change +
-- backfill on a live table.
--
-- Nullable: existing rows (pre-this-column registrations, e2e/test fixtures)
-- have no age on file and must not fail a NOT NULL constraint retroactively.
-- ASCII only. LF only.
-- ============================================================================

-- BLOCK 0 -- confirm before touching anything. Read-only. Run alone.
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications' AND column_name = 'age';
-- expect: 0 rows (column does not exist yet).

-- BLOCK 1 -- add the column. Re-run-safe (IF NOT EXISTS).
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS age integer;

COMMENT ON COLUMN public.genesis_applications.age IS
  'Self-reported age at registration. Collected 2026-08-23 (C-7); no minimum-age gate yet -- TK pending, HQ recommends 18.';

-- BLOCK 2 -- verify (read-only): column exists, nullable, no default.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications' AND column_name = 'age';
-- expect: 1 row, data_type='integer', is_nullable='YES', column_default=null.

-- REVERT -- do NOT run with the blocks above. Separate action only.
-- ALTER TABLE public.genesis_applications DROP COLUMN IF EXISTS age;
