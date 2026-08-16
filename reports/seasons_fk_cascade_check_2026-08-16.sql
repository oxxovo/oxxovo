-- Read-only. Every foreign key across the DB that references public.seasons,
-- with its ON DELETE rule. Answers whether deleteSeason() cascades into
-- genesis_applications (that table's own CREATE TABLE is not in this repo,
-- so the rule is unknown without this check).

SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'seasons'
ORDER BY tc.table_name;
