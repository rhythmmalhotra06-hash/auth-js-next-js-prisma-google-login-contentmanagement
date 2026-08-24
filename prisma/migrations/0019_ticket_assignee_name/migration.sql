-- Durable creative attribution.
--
-- 👬 Employees in the Creative Services base is synced from HR, so an offboarded person's
-- row is DELETED by the sync. Airtable link cells hold a pointer to a record, so every
-- "Assigned Creative" cell pointing at that row silently blanks — and the ticket reconcile
-- then wrote that blank into `tickets.assignee_id`. Result: tickets lose the credit for
-- who actually did the work.
--
-- `assignee_name` is the snapshot that survives all of it: written whenever an assignee is
-- set (app write or resolved Airtable pull), read as the fallback when the FK is null.

ALTER TABLE "tickets" ADD COLUMN "assignee_name" TEXT;

-- Seed from the current FK so existing tickets carry their credit immediately. Employees
-- are never hard-deleted from the mirror (sync.ts deactivates orphans), so rows for people
-- who have already left still resolve here.
UPDATE "tickets" t
   SET "assignee_name" = e."name"
  FROM "employees" e
 WHERE e."id" = t."assignee_id"
   AND t."assignee_name" IS NULL;
