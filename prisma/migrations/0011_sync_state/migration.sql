-- Sync watermark store (Phase 3 inbound pull). Holds the newest Airtable
-- "App Last Modified (sync)" value we've imported, so the pull is incremental.

CREATE TABLE "sync_state" (
    "key"        TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("key")
);
