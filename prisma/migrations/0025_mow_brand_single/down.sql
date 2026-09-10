-- Rollback for 0025.
ALTER TABLE "messages_of_week" DROP COLUMN IF EXISTS "brand";
ALTER TABLE "messages_of_week" ADD COLUMN IF NOT EXISTS "brands" TEXT[] NOT NULL DEFAULT '{}';
