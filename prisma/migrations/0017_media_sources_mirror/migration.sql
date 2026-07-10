-- Phase 4 · Media Sources read-mirror (PG read replica; Airtable stays source of truth).
-- ADDITIVE — safe to apply while MEDIA_BACKEND stays 'airtable'. No outbox column (writes go
-- to Airtable + write-through here). Clip Suggestions are NOT mirrored (deferred).

CREATE TABLE "media_sources" (
    "id"                          UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"                 TEXT,
    "title"                       TEXT,
    "source_url"                  TEXT,
    "download_url"                TEXT,
    "platform"                    TEXT,
    "status"                      TEXT,
    "guest_show"                  TEXT,
    "audience"                    TEXT,
    "submitted_via"               TEXT,
    "used_web_search"             BOOLEAN NOT NULL DEFAULT false,
    "strategy_json"               TEXT,
    "transcript"                  TEXT,
    "error"                       TEXT,
    "submitted_date"              TEXT,
    "clips_added_date"            TEXT,
    "clip_suggestion_ids"         TEXT[] NOT NULL DEFAULT '{}',
    "submitted_by_id"             TEXT,
    "ticket_event_type_id"        TEXT,
    "ticket_asset_type_id"        TEXT,
    "ticket_official_calendar_id" TEXT,
    "ticket_due_date"             TEXT,
    "source_record_id"            TEXT,
    "created_time"                TEXT,
    "synced_at"                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "media_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "media_sources_airtable_id_key" ON "media_sources" ("airtable_id");
