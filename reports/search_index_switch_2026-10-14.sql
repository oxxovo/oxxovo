-- search_index_allowed switch (HQ 2026-10-14, A-8). NOT RUN by the change that added the code.
-- The code (lib/search-index.ts) is fail-closed: a missing row = noindex, so running BLOCK 1 is optional
-- polish (makes the switch visible in /admin/settings) and changes nothing by itself.
-- ASCII only, LF only. One block = one statement. Deliver the BODY in chat, not this path.

-- BLOCK 0 -- read only. Expect 0 rows before BLOCK 1; after BLOCK 1 expect one row with value false.
select key, value, value_type, updated_at from public.platform_config where key = 'search_index_allowed';

-- BLOCK 1 -- create the key CLOSED ('false' = noindex stays). on conflict do nothing: never overwrites an existing value.
insert into public.platform_config (key, value, value_type, description) values ('search_index_allowed', 'false', 'bool', 'When true, the Watch pages (/watch, /watch/[id], /watch/rankings) no longer carry a noindex robots tag and search engines may index them. Anything else, a missing row or a read failure keeps noindex.') on conflict (key) do nothing returning key, value, value_type, updated_at;
