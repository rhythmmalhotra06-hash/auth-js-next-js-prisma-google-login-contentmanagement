-- Dedupe flag for the "asset ready" Slack notification. Moved off the Airtable
-- "Asset Ready Notified" checkbox now that Postgres is the write system of record
-- for tickets (Phase 2 of the PG-SoR + two-way-sync work).

ALTER TABLE "tickets" ADD COLUMN "asset_ready_notified" BOOLEAN NOT NULL DEFAULT false;
