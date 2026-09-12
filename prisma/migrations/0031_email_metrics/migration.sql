-- The email half of the performance loop — social_metrics for Braze.
--
-- Grain is the CAMPAIGN, which is one email to one audience list: a planned email goes to six to
-- eleven lists (Daily, Highlights, Weekly, Members, Coach, Events, Vishen's List, Mastery) and
-- each is its own Braze campaign with its own open rate.
--
-- window_days = 2 is the honest "24 hours": Braze's /campaigns/data_series returns DAILY buckets,
-- so the closest true figure is the send day plus the next. window_days NULL = every bucket to date.
CREATE TABLE IF NOT EXISTS "email_metrics" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Braze REST campaign id. NOT the 24-hex dashboard ObjectId the team pastes into Airtable.
    "braze_campaign_id" TEXT NOT NULL,
    "campaign_name"     TEXT NOT NULL,
    "subject"           TEXT,
    "audience"          TEXT,
    -- The 📧 Emails recId once matched. NULL means no campaign matched, never zero results.
    "email_airtable_id" TEXT,
    "match_score"       DECIMAL(3,2),
    "first_sent_at"     TIMESTAMPTZ,
    "sent"              INTEGER,
    "delivered"         INTEGER,
    "unique_opens"      INTEGER,
    -- Apple MPP opens, kept apart: they inflate any open rate that includes them.
    "machine_opens"     INTEGER,
    "unique_clicks"     INTEGER,
    "unsubscribes"      INTEGER,
    "reported_spam"     INTEGER,
    "conversions"       INTEGER,
    "revenue"           DECIMAL(12,2),
    "window_days"       INTEGER,
    "captured_at"       TIMESTAMPTZ NOT NULL,
    "source"            TEXT NOT NULL,
    "raw"               JSONB,
    "dedupe_key"        TEXT NOT NULL,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "email_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_metrics_dedupe_key_key" ON "email_metrics"("dedupe_key");
CREATE INDEX IF NOT EXISTS "idx_email_metrics_email"    ON "email_metrics"("email_airtable_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_email_metrics_campaign" ON "email_metrics"("braze_campaign_id", "captured_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_email_metrics_sent"     ON "email_metrics"("first_sent_at");
