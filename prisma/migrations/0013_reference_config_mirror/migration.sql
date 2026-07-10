-- Phase 1 · Mirror reference/auth/config into Postgres (read-PG / write-Airtable).
-- All ADDITIVE — safe to apply while the app still serves from Airtable. Populated by
-- the extended syncReference(); no reads switch to PG until the REFERENCE_BACKEND flag
-- flips (Phase 1b), so this has no runtime effect on its own.

-- Employees: app-access roles + per-person capacity (were Airtable-only).
ALTER TABLE "employees" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "employees" ADD COLUMN "capacity" INTEGER;

-- Event / Asset type scoring knobs (feed getScoringConfig).
ALTER TABLE "event_types" ADD COLUMN "load_weight" DOUBLE PRECISION;
ALTER TABLE "event_types" ADD COLUMN "tier_norm" DOUBLE PRECISION;

ALTER TABLE "asset_types" ADD COLUMN "full_name" TEXT;
ALTER TABLE "asset_types" ADD COLUMN "creative_category" TEXT;
ALTER TABLE "asset_types" ADD COLUMN "load_weight" DOUBLE PRECISION;
ALTER TABLE "asset_types" ADD COLUMN "effort_norm" DOUBLE PRECISION;
ALTER TABLE "asset_types" ADD COLUMN "dna_requirements" TEXT;
ALTER TABLE "asset_types" ADD COLUMN "feedback_standards" TEXT;
ALTER TABLE "asset_types" ADD COLUMN "dna_updated_by" TEXT;

-- Contractors / freelancers — the second assignable pool (had no PG model).
CREATE TABLE "contractors" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"   TEXT,
    "name"          TEXT NOT NULL,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "service_level" TEXT,
    "capacity"      INTEGER,
    "synced_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contractors_airtable_id_key" ON "contractors" ("airtable_id");

-- ⚙️ Scoring Config global knobs (key→value).
CREATE TABLE "scoring_config" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "key"         TEXT NOT NULL,
    "value"       DOUBLE PRECISION,
    "label"       TEXT,
    "group"       TEXT,
    "note"        TEXT,
    "updated_by"  TEXT,
    "synced_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "scoring_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scoring_config_airtable_id_key" ON "scoring_config" ("airtable_id");

-- 🧠 Clip Rules — editable clip-generation prompt.
CREATE TABLE "clip_rules" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"         TEXT,
    "name"                TEXT,
    "kind"                TEXT,
    "clip_type"           TEXT,
    "content"             TEXT,
    "active"              BOOLEAN NOT NULL DEFAULT true,
    "order"               INTEGER,
    "section"             TEXT,
    "note"                TEXT,
    "updated_by"          TEXT,
    "airtable_updated_at" TEXT,
    "created_time"        TEXT,
    "synced_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "clip_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clip_rules_airtable_id_key" ON "clip_rules" ("airtable_id");
