-- Phase 4 · Vishen's Videos as PG system-of-record (two-way Airtable sync). ADDITIVE — safe
-- to apply while VISHEN_VIDEOS_BACKEND stays 'airtable'. The team maintains most fields in
-- Airtable (pulled in); the app writes back only approval/rating/views_24h (loop-safe).

CREATE TABLE "vishen_videos" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"        TEXT,
    "name"               TEXT,
    "source"             TEXT,
    "medium"             TEXT,
    "format"             TEXT,
    "product"            TEXT,
    "status"             TEXT,
    "approval"           TEXT,
    "published_link"     TEXT,
    "live_date"          TEXT,
    "rating"             INTEGER,
    "views_24h"          TEXT,
    "created_time"       TEXT,
    "airtable_pushed_at" TIMESTAMPTZ,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "synced_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "vishen_videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vishen_videos_airtable_id_key" ON "vishen_videos" ("airtable_id");
CREATE INDEX "idx_vishen_videos_pushed" ON "vishen_videos" ("airtable_pushed_at");
