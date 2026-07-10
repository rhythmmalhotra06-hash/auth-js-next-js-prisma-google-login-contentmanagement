-- Phase 3 · Social board as PG system-of-record (two-way Airtable sync) + mirror the
-- Content & Comms calendar for the /social/new picker. ADDITIVE — safe to apply while
-- SOCIAL_BACKEND stays 'airtable'.

CREATE TABLE "social_posts" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"        TEXT,
    "title"              TEXT,
    "notes"              TEXT,
    "captions"           TEXT,
    "status"             TEXT,
    "clip_source_url"    TEXT,
    "source_title"       TEXT,
    "virality_score"     INTEGER,
    "timecode"           TEXT,
    "creative_ticket_id" TEXT,
    "official_cal_id"    TEXT,
    "created_time"       TEXT,
    "airtable_pushed_at" TIMESTAMPTZ,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "synced_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_posts_airtable_id_key" ON "social_posts" ("airtable_id");
CREATE INDEX "idx_social_pushed" ON "social_posts" ("airtable_pushed_at");

CREATE TABLE "comms_calendars" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name"        TEXT NOT NULL,
    "status"      TEXT,
    "start_date"  TEXT,
    "end_date"    TEXT,
    "synced_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "comms_calendars_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "comms_calendars_airtable_id_key" ON "comms_calendars" ("airtable_id");
