-- E8 · AI Content Clipping Engine
-- Transcript → 10-section viral strategy (JSON) → selectable clips → proposed tickets.

-- CreateTable: one long-form transcript + the context it was generated with.
CREATE TABLE "content_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "guest_name" TEXT,
    "guest_audience" TEXT,
    "brand_pillars" TEXT,
    "transcript" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "content_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: one generation run; full 10-section strategy in `output` (JSON).
CREATE TABLE "clip_strategies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_source_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "error" TEXT,
    "output" JSONB,
    "used_web_search" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "clip_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: the Reels clips, broken out for propose → approve → ticket tracking.
CREATE TABLE "clip_suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clip_strategy_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "timestamp_start" TEXT,
    "timestamp_end" TEXT,
    "rationale" TEXT,
    "caption" TEXT,
    "hook_line" TEXT,
    "format" TEXT,
    "platform" TEXT,
    "virality_score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "ticket_id" UUID,

    CONSTRAINT "clip_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_clip_strategies_source" ON "clip_strategies"("content_source_id");
CREATE INDEX "idx_clip_suggestions_strategy" ON "clip_suggestions"("clip_strategy_id");

-- AddForeignKey
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clip_strategies" ADD CONSTRAINT "clip_strategies_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_suggestions" ADD CONSTRAINT "clip_suggestions_clip_strategy_id_fkey" FOREIGN KEY ("clip_strategy_id") REFERENCES "clip_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_suggestions" ADD CONSTRAINT "clip_suggestions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
