-- Phase 0 · Generalize the two-way sync engine.
-- Make the push outbox polymorphic so one drainer serves every domain (tickets,
-- shoots, social, media/Vishen, config) instead of being ticket-only.
--
-- Backward-compatible / order-independent (safe whether this runs before OR after
-- the code deploy):
--   • `entity`    defaults to 'ticket' → rows inserted by the OLD code are valid.
--   • `entity_id` is NULLABLE → OLD inserts (which set only ticket_id) don't violate
--     a constraint; the drainer falls back to ticket_id for legacy 'ticket' rows.
--   • NEW code writes (entity, entity_id) and stops relying on ticket_id.

ALTER TABLE "airtable_outbox" ADD COLUMN "entity" TEXT NOT NULL DEFAULT 'ticket';
ALTER TABLE "airtable_outbox" ADD COLUMN "entity_id" TEXT;

-- Backfill in-flight rows so the drainer can group them by (entity, entity_id).
UPDATE "airtable_outbox" SET "entity_id" = "ticket_id"::text WHERE "entity_id" IS NULL;

-- ticket_id is now legacy; new rows may omit it.
ALTER TABLE "airtable_outbox" ALTER COLUMN "ticket_id" DROP NOT NULL;

-- Drainer groups pending rows by domain + id.
CREATE INDEX IF NOT EXISTS "idx_outbox_entity" ON "airtable_outbox" ("entity", "entity_id");
