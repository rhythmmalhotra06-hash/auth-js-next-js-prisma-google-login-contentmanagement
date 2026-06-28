-- Metric snapshots · precomputed aggregates so dashboards read one cheap row
-- instead of scanning the ~10k-row Airtable ticket table on every load.
-- Refreshed by POST /api/metrics/refresh (nightly cron).

CREATE TABLE "metric_snapshots" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("key")
);
