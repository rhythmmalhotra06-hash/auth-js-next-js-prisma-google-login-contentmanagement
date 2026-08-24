-- Performance loop · per-post social metrics (the sink).
-- ADDITIVE — new table only, nothing else touched. Safe to apply any time.
--
-- One row per (source, post, window, captured day) via dedupe_key, so re-running a
-- pull the same day UPDATEs instead of piling up duplicates. Every metric column is
-- nullable: sources disagree about what they can report (Meta killed IG impressions
-- in Apr 2025), so we store what we're given and show the best available.
--
-- See plans/i-got-the-mcp-temporal-summit.md.

CREATE TABLE "social_metrics" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform_post_id"   TEXT,
    "published_url"      TEXT,
    "vishen_video_id"    TEXT,
    "ticket_airtable_id" TEXT,
    "channel"            TEXT,
    "impressions"        INTEGER,
    "views"              INTEGER,
    "reach"              INTEGER,
    "engagements"        INTEGER,
    "engagement_rate"    DECIMAL(6,3),
    "clicks"             INTEGER,
    "window_days"        INTEGER,
    "captured_at"        TIMESTAMPTZ NOT NULL,
    "source"             TEXT NOT NULL,
    "entered_by"         TEXT,
    "raw"                JSONB,
    "dedupe_key"         TEXT NOT NULL,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "social_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_metrics_dedupe_key_key" ON "social_metrics" ("dedupe_key");
CREATE INDEX "idx_social_metrics_url"    ON "social_metrics" ("published_url", "captured_at");
CREATE INDEX "idx_social_metrics_video"  ON "social_metrics" ("vishen_video_id", "captured_at");
CREATE INDEX "idx_social_metrics_ticket" ON "social_metrics" ("ticket_airtable_id", "captured_at");
