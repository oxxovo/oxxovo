# DB objects that exist in production but not in this repo

**Measured 2026-07-28** against the live database, after the `handle_new_user`
incident. Root cause of that incident was not the stray migration — it was that
**the repo could not answer "does this object exist?"**, so a stale code comment
got used as evidence instead, and a live signup trigger was dropped.

This file is the inventory of that blind spot.

## Why this happened structurally

`reports/*.sql` tracks **ALTERs and later additions**. The **founding schema was
created in the Supabase dashboard** and never committed. So the repo records how
tables were *changed* but not that they *exist*, and objects that PostgREST does
not expose (trigger functions, triggers, policies) are invisible to it entirely.

`public.handle_new_user` was exactly that: a trigger function, so not in the REST
schema, and dashboard-created, so not in the repo. Two blind spots at once.

## Measurement method (and its limits)

- **Relations + REST-exposed functions**: `GET /rest/v1/` OpenAPI schema, service
  role.
- **Repo side**: `git grep` for `CREATE TABLE|VIEW|FUNCTION` over `reports/*.sql`
  and `supabase/` across **every commit on every branch** (`git rev-list --all`),
  so "missing" means missing from the whole repo, not just from `main`.
- **This is a floor, not a ceiling.** The OpenAPI schema cannot see: triggers,
  RLS policies, non-exposed functions (including every trigger function),
  indexes, constraints, enums, column defaults, GRANTs, or anything outside the
  `public` schema. Those need the SQL queries at the bottom of this file.

## Relations: 35 live / 26 tracked / **9 with no CREATE anywhere in the repo**

| Relation | Notes |
|---|---|
| `profiles` | ★ accounts. `email` is NOT NULL — the constraint at the centre of the 2026-07-28 incident. A `CREATE TABLE profiles` appears only in the May planning docs (`reports/admin-plan-2026-05.md`), which predate ~25 added columns. |
| `seasons` | ★ every operating parameter (schedule, prizes, weights, Studio config). All dynamic-season code reads this. |
| `platform_config` | ★ master switches + Founding Creator cap/term. Read fail-closed by `lib/membership.ts`. |
| `genesis_applications` | ★ entries + scores + submission state. |
| `applications` | legacy/parallel entries table. |
| `member_tier_config` | partner tiers; `profiles.partner_tier` FKs to it. |
| `partner_tournaments` | member-hosted tournaments. |
| `season_recommendations` | AI season recommendations. |
| `official_actors` | Studio AI actors. |

Tracked (26): `backup_genesis_user_id_20260606`, `chat_logs`,
`credit_transactions`, `email_inbound_log`, `email_logs`, `generation_jobs`,
`membership_events`, `membership_founding_counter`, `model_catalog`,
`partner_status_events`, `pre_registrations`, `promo_videos`, `render_jobs`,
`scoring_results`, `seasons_public`, `studio_characters`, `studio_music_assets`,
`studio_presets`, `system_messages`, `watch_comment_reports`, `watch_comments`,
`watch_follows`, `watch_likes`, `watch_video_reports`, `watch_views`,
`watch_votes`.

## REST-exposed functions: 9 live / 6 tracked / **3 untracked**

| Function | Notes |
|---|---|
| `genesis_application_count` | referenced by `reports/genesis_rls_2026-06.sql` but never defined there |
| `get_active_application_count` | capacity/waitlist gate |
| `rls_auto_enable` | RLS helper |

Tracked: `advance_season_finalists`, `apply_season_recommendations`,
`defer_season_schedule`, `is_admin`, `is_staff`, `link_user_applications`.

## Not measurable from here — needs a SQL editor run

`public.handle_new_user` does **not** appear in the function list above, because
trigger functions are not REST-exposed. That is the whole point: the class of
object that caused the incident is the class this method cannot see. Run the
queries below and commit the output.

Now tracked: `reports/auth_handle_new_user_2026-07-28.sql`.

### Q1 — every non-internal trigger in the database

```sql
SELECT n.nspname AS schema, c.relname AS table_name, t.tgname AS trigger_name,
       p.proname AS function_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c     ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p      ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;
```

### Q2 — every function in `public`, full source

```sql
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

### Q3 — every RLS policy

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;
```

### Q4 — the 9 untracked tables, column by column

```sql
SELECT table_name, ordinal_position, column_name, data_type, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles','seasons','platform_config',
    'genesis_applications','applications','member_tier_config',
    'partner_tournaments','season_recommendations','official_actors')
ORDER BY table_name, ordinal_position;
```

### Q5 — constraints on those tables (the NOT NULL / CHECK / UNIQUE that bite)

```sql
SELECT c.conrelid::regclass AS table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN ('profiles','seasons','platform_config',
    'genesis_applications','applications','member_tier_config',
    'partner_tournaments','season_recommendations','official_actors')
ORDER BY table_name, c.contype, c.conname;
```

## Standing rules this establishes

1. **Never conclude a DB object does not exist from repo evidence alone.** The
   repo cannot prove absence. Check the DB.
2. **A code comment is a claim, not evidence.** `lib/nickname.ts` asserted the
   trigger did not exist; it had been firing in production for over a month.
3. **Before any DROP of a function/trigger/view, save its definition first.**
   `pg_get_functiondef` / `pg_get_triggerdef` / `pg_get_viewdef` output goes into
   `reports/` in the same session, as a separate STEP 0 block. Prefer
   `RENAME TO <name>_bak` over `DROP` where the object is replaceable.
4. **Any object created in the dashboard gets a `reports/` file the same day.**
