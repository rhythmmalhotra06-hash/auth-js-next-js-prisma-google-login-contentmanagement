-- Revision 2 (10 Sep workshop): the MOW master moved and brand became single-valued.
--
-- The 10 Sep build session settled one message row PER BRAND per week, with Brand as a
-- single-select in Airtable — so `brands text[]` was the wrong shape. MowWeek's
-- (week_start, brand) key already assumed this, so nothing downstream changes.
--
-- Safe: messages_of_week landed in 0024_mow and has no rows yet (MOW_BACKEND defaults to
-- 'airtable', so nothing has been pulled). The column is replaced rather than migrated.
ALTER TABLE "messages_of_week" DROP COLUMN IF EXISTS "brands";
ALTER TABLE "messages_of_week" ADD COLUMN IF NOT EXISTS "brand" TEXT;
