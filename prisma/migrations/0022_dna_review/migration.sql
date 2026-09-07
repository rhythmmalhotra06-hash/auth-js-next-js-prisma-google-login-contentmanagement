-- E13 — AI-Assisted DNA Feedback. Three new, additive, Postgres-native tables.
-- No existing table is modified. See prd/content-production-management/dna-feedback/technical-design.md.

CREATE TABLE "dna_review_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_type_id" UUID NOT NULL,
    "statement" TEXT NOT NULL,
    "rationale" TEXT,
    "example" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 3,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "source_ticket_id" UUID,
    "note" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "dna_review_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dna_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "asset_type_id" UUID,
    "model" TEXT NOT NULL,
    "used_transcript" BOOLEAN NOT NULL DEFAULT false,
    "used_frames" BOOLEAN NOT NULL DEFAULT false,
    "transcript_source_url" TEXT,
    "frame_source_url" TEXT,
    "frame_count" INTEGER,
    "cost_micros" INTEGER,
    "summary" TEXT,
    "triggered_by" TEXT NOT NULL,
    "requested_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "dna_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dna_review_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "dimension" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "evidence" TEXT,
    "timestamp_ms" INTEGER,
    "rule_id" UUID,
    "reaction" TEXT,
    "reaction_note" TEXT,
    "reacted_by" TEXT,
    "reacted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "dna_review_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_dna_review_rules_asset_type_active" ON "dna_review_rules"("asset_type_id", "active");
CREATE INDEX "idx_dna_reviews_ticket_created" ON "dna_reviews"("ticket_id", "created_at");

ALTER TABLE "dna_review_rules" ADD CONSTRAINT "dna_review_rules_asset_type_id_fkey"
    FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dna_review_rules" ADD CONSTRAINT "dna_review_rules_source_ticket_id_fkey"
    FOREIGN KEY ("source_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dna_reviews" ADD CONSTRAINT "dna_reviews_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dna_review_findings" ADD CONSTRAINT "dna_review_findings_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "dna_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dna_review_findings" ADD CONSTRAINT "dna_review_findings_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "dna_review_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
