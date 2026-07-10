-- Phase 2 · Shoots as PG system-of-record (two-way Airtable sync).
-- ADDITIVE. Reuses the existing `location` (→ filmingLocation) and `notes` (→ brief)
-- columns from the original reference model; `shoot_date` becomes dead (superseded by
-- filming_date text). Link fields are stored as Airtable recId arrays. Safe to apply
-- while SHOOTS_BACKEND stays 'airtable' — nothing reads these until the flag flips.

ALTER TABLE "shoots" ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "shoots" ADD COLUMN "format"             TEXT;
ALTER TABLE "shoots" ADD COLUMN "filming_date"       TEXT;
ALTER TABLE "shoots" ADD COLUMN "production_support" TEXT;
ALTER TABLE "shoots" ADD COLUMN "vishen_approved"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shoots" ADD COLUMN "priority_ranking"   INTEGER;
ALTER TABLE "shoots" ADD COLUMN "raw_files"          TEXT;
ALTER TABLE "shoots" ADD COLUMN "platforms"          TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "new_prio_ticket"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shoots" ADD COLUMN "requested_by_id"    TEXT;
ALTER TABLE "shoots" ADD COLUMN "author_ids"         TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "event_type_ids"     TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "asset_type_ids"     TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "asset_library_ids"  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "ticket_ids"         TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "shoots" ADD COLUMN "created_time"       TEXT;
ALTER TABLE "shoots" ADD COLUMN "airtable_pushed_at" TIMESTAMPTZ;
ALTER TABLE "shoots" ADD COLUMN "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "shoots" ADD COLUMN "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "idx_shoots_pushed" ON "shoots" ("airtable_pushed_at");
