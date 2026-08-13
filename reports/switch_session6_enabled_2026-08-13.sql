-- =========================================================================
-- Switch 1/2 -- session6_enabled true (open Studio to the public)
-- HQ 2026-08-13: app+worker deploy is done, TK wants to turn things on and
-- try it for real. Run this one FIRST, look at the site, THEN (separately,
-- later) switch 2 (studio_purchase_enabled) -- opening the surface and
-- opening money are two different decisions.
--
-- BLOCK 0 confirmed live 2026-08-13 (read-only probe): value='false' on
-- both switches right now, row already exists (created 2026-06, never
-- flipped since). This is an UPDATE, not an insert.
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
WHERE key = 'session6_enabled';


-- =========================================================================
-- BLOCK 1 -- flip it. Run alone, after BLOCK 0 confirms.
-- =========================================================================
UPDATE public.platform_config
SET value = 'true'
WHERE key = 'session6_enabled'
RETURNING key, value, value_type;


-- =========================================================================
-- BLOCK 2 -- verify (read-only, same query as BLOCK 0)
--
-- EXPECT: value='true' now
-- =========================================================================
SELECT key, value, value_type, description
FROM public.platform_config
WHERE key = 'session6_enabled';
