-- FAQ items -- app/admin/faq. Design: reports/admin_faq_editor_design_2026-08-12.md
-- Base table = service_role only (no anon/authenticated grant, RLS on, 0 policies --
-- same fail-closed shape as admin_broadcasts). Public reads go through
-- faq_items_public, which pre-filters to is_active=true and strips to display
-- columns only -- same split as seasons_public, adopted after the 2026-08-14
-- seasons GRANT leak (base table locked, view is the one thing anon can read).

-- STEP 1: table
create table if not exists faq_items (
  id uuid primary key default gen_random_uuid(),
  surface text not null default 'landing_home',
  question_en text not null,
  question_ko text not null,
  answer_en text not null,
  answer_ko text not null,
  sort_order integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table faq_items enable row level security;
-- no policies created on purpose -- service_role bypasses RLS, anon/authenticated get nothing.

-- STEP 2: public view -- active rows only, display columns only
create or replace view faq_items_public as
  select id, surface, question_en, question_ko, answer_en, answer_ko, sort_order
  from faq_items
  where is_active = true
  order by sort_order asc;

grant select on faq_items_public to anon, authenticated;

-- STEP 3: verify (read-only, no writes)
select relname, relrowsecurity from pg_class where relname = 'faq_items';

select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'faq_items'
order by grantee, privilege_type;

select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'faq_items_public'
order by grantee, privilege_type;

select count(*) as faq_items_row_count from faq_items;
