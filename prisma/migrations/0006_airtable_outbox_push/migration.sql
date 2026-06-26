-- Phase 2 · Two-way ticket sync (PUSH: portal → Airtable)
-- Outbox pattern: ticket writes enqueue a row in the same transaction; a
-- background drainer pushes current ticket state to Airtable, batched + paced.

-- Echo-suppression window for the future Phase 3 pull (our own write coming back).
ALTER TABLE "tickets" ADD COLUMN "airtable_pushed_at" TIMESTAMPTZ;

-- CreateTable: pending pushes, enqueued by ticket_id (drainer reads current state).
CREATE TABLE "airtable_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "op" TEXT NOT NULL DEFAULT 'upsert',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "airtable_outbox_pkey" PRIMARY KEY ("id")
);

-- Drainer scans pending rows oldest-first.
CREATE INDEX "idx_outbox_pending" ON "airtable_outbox" ("status", "enqueued_at");
