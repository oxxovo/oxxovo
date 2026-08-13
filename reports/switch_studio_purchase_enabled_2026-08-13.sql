-- =========================================================================
-- Switch 2/2 -- studio_purchase_enabled true (open the Stripe credit buy flow)
-- HQ 2026-08-13: run this ONLY AFTER switch 1 (session6_enabled) has been
-- run and the site has actually been looked at. This one turns money on --
-- session6 opens the door, this opens the cash register. Do not run both
-- switches back to back without looking in between.
--
-- BLOCK 0 confirmed live 2026-08-13 (read-only probe): value='false' right
-- now, row already exists (created 2026-06, never flipped since). This is
-- an UPDATE, not an insert.
--
-- ASCII-only. LF-only. No rollback block included (add one separately if
-- you actually need to flip back).
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: 1 row, value='false', value_type='bool'
-- =========================================================================
SELECT key, value, value_type, description
FROM public.platform_config
WHERE key = 'studio_purchase_enabled';


-- =========================================================================
-- BLOCK 1 -- flip it. Run alone, after BLOCK 0 confirms.
-- =========================================================================
UPDATE public.platform_config
SET value = 'true'
WHERE key = 'studio_purchase_enabled'
RETURNING key, value, value_type;


-- =========================================================================
-- BLOCK 2 -- verify (read-only, same query as BLOCK 0)
--
-- EXPECT: value='true' now
-- =========================================================================
SELECT key, value, value_type, description
FROM public.platform_config
WHERE key = 'studio_purchase_enabled';
