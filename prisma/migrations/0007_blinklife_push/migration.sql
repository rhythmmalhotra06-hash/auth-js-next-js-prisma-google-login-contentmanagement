-- BlinkLife integration · push editor tasks (portal → BlinkLife)
-- Mirror of the Airtable push outbox (0006): ticket writes enqueue a row in the
-- same transaction; a background drainer pushes current ticket state to BlinkLife
-- via its MCP API, batched + paced. Separate table so the two push targets enable,
-- fail, and schedule independently.

-- Observability: last time a ticket was mirrored into BlinkLife as an editor task.
ALTER TABLE "tickets" ADD COLUMN "blinklife_pushed_at" TIMESTAMPTZ;

-- CreateTable: pending pushes, enqueued by ticket_id (drainer reads current state).
CREATE TABLE "blinklife_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "op" TEXT NOT NULL DEFAULT 'upsert',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "blinklife_outbox_pkey" PRIMARY KEY ("id")
);

-- Drainer scans pending rows oldest-first.
CREATE INDEX "idx_blinklife_outbox_pending" ON "blinklife_outbox" ("status", "enqueued_at");

-- CreateTable: external-id provenance for BlinkLife entities we create (idempotency).
CREATE TABLE "blinklife_refs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "ticket_id" UUID,
    "external_id" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "blinklife_refs_pkey" PRIMARY KEY ("id")
);

-- One ref per (kind, ticket): a re-push updates the same external entity.
-- NOTE: Postgres treats NULLs as distinct, so singleton kinds (e.g. 'project',
-- ticket_id IS NULL) are de-duplicated in application code, not by this constraint.
CREATE UNIQUE INDEX "uniq_blinklife_ref" ON "blinklife_refs" ("kind", "ticket_id");
