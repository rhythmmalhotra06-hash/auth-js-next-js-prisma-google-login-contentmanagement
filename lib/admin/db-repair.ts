'use server';

// TEMPORARY self-service schema repair. The deployed app is connected to a
// database that `kessel db` cannot reach and that is missing recent migrations
// (tickets columns + outbox/ref tables), which breaks ticket.create. These actions
// run on the APP's own Prisma connection, so they inspect/repair the CORRECT
// database. Auth-gated; the repair is a fixed, idempotent DDL batch (no
// client-supplied SQL). Remove after the DB is reconciled.

import { prisma } from '@/lib/prisma';

// Access control: this temporary tool relies on the platform IAP (only authorized
// @mindvalley Google accounts can reach the deployed service). The app-level
// NextAuth session gate was removed because sessions are currently broken
// ("Invalid Compact JWE"), which blocked the repair. Remove the whole tool after
// the DB is reconciled.

export interface SchemaDiagnosis {
  ok: boolean;
  error?: string;
  database?: string;
  user?: string;
  ticketColumns?: string[];
  missingTicketColumns?: string[];
  tables?: Record<string, boolean>;
}

// Nullable, additive ticket columns from migrations 0003 / 0006 / 0007. (Base
// NOT-NULL columns from 0001/0002 are assumed present — the queue reads them.)
const EXPECTED_TICKET_COLUMNS = [
  'positioning', 'audience', 'notes', 'official_calendar_id', 'requester_id',
  'source_links', 'team_service_level', 'type_of_request',
  'airtable_pushed_at', 'blinklife_pushed_at',
];

const EXPECTED_TABLES = [
  'official_calendar', 'authors', 'ticket_authors',
  'content_sources', 'clip_strategies', 'clip_suggestions',
  'airtable_outbox', 'blinklife_outbox', 'blinklife_refs',
];

export async function diagnoseSchema(): Promise<SchemaDiagnosis> {
  try {
    const meta = await prisma.$queryRaw<{ db: string; usr: string }[]>`
      SELECT current_database()::text AS db, current_user::text AS usr`;
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='tickets' ORDER BY column_name`;
    const ticketColumns = cols.map((c) => c.column_name);
    const tableRows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    const present = new Set(tableRows.map((t) => t.table_name));
    const tables: Record<string, boolean> = {};
    for (const t of EXPECTED_TABLES) tables[t] = present.has(t);
    return {
      ok: true,
      database: meta[0]?.db,
      user: meta[0]?.usr,
      ticketColumns,
      missingTicketColumns: EXPECTED_TICKET_COLUMNS.filter((c) => !ticketColumns.includes(c)),
      tables,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Fixed, idempotent DDL — safe to re-run. Brings the app's DB up to migrations
// 0003–0007. FK constraints are intentionally omitted (Prisma manages relations at
// the app layer; columns/tables are what create/push need, and skipping FKs keeps
// the batch re-runnable without duplicate-constraint errors).
const REPAIR_STATEMENTS: string[] = [
  // --- 0003 + 0006 + 0007: additive ticket columns (all nullable) ---
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "positioning" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "audience" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "official_calendar_id" UUID`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requester_id" UUID`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "source_links" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "team_service_level" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "type_of_request" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "airtable_pushed_at" TIMESTAMPTZ`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "blinklife_pushed_at" TIMESTAMPTZ`,
  // --- 0004: assets provenance ---
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "name" TEXT`,
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "source_table" TEXT`,
  // --- 0003: reference + join tables ---
  `CREATE TABLE IF NOT EXISTS "official_calendar" (
     "id" UUID NOT NULL DEFAULT gen_random_uuid(), "airtable_id" TEXT, "name" TEXT NOT NULL,
     "status" TEXT, "start_date" DATE, "end_date" DATE,
     "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "official_calendar_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "official_calendar_airtable_id_key" ON "official_calendar"("airtable_id")`,
  `CREATE TABLE IF NOT EXISTS "authors" (
     "id" UUID NOT NULL DEFAULT gen_random_uuid(), "airtable_id" TEXT, "name" TEXT NOT NULL,
     "title" TEXT, "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "authors_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "authors_airtable_id_key" ON "authors"("airtable_id")`,
  `CREATE TABLE IF NOT EXISTS "ticket_authors" (
     "ticket_id" UUID NOT NULL, "author_id" UUID NOT NULL,
     CONSTRAINT "ticket_authors_pkey" PRIMARY KEY ("ticket_id","author_id"))`,
  // --- 0006: Airtable push outbox ---
  `CREATE TABLE IF NOT EXISTS "airtable_outbox" (
     "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticket_id" UUID NOT NULL,
     "op" TEXT NOT NULL DEFAULT 'upsert', "status" TEXT NOT NULL DEFAULT 'pending',
     "attempts" INTEGER NOT NULL DEFAULT 0, "last_error" TEXT,
     "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "processed_at" TIMESTAMPTZ,
     CONSTRAINT "airtable_outbox_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "idx_outbox_pending" ON "airtable_outbox" ("status", "enqueued_at")`,
  // --- 0007: BlinkLife push outbox + refs ---
  `CREATE TABLE IF NOT EXISTS "blinklife_outbox" (
     "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticket_id" UUID NOT NULL,
     "op" TEXT NOT NULL DEFAULT 'upsert', "status" TEXT NOT NULL DEFAULT 'pending',
     "attempts" INTEGER NOT NULL DEFAULT 0, "last_error" TEXT,
     "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "processed_at" TIMESTAMPTZ,
     CONSTRAINT "blinklife_outbox_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "idx_blinklife_outbox_pending" ON "blinklife_outbox" ("status", "enqueued_at")`,
  `CREATE TABLE IF NOT EXISTS "blinklife_refs" (
     "id" UUID NOT NULL DEFAULT gen_random_uuid(), "kind" TEXT NOT NULL, "ticket_id" UUID,
     "external_id" TEXT NOT NULL, "synced_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT "blinklife_refs_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_blinklife_ref" ON "blinklife_refs" ("kind", "ticket_id")`,
];

export interface RepairResult {
  ok: boolean;
  error?: string;
  applied: number;
  failures: { stmt: string; error: string }[];
}

export async function repairSchema(): Promise<RepairResult> {
  let applied = 0;
  const failures: { stmt: string; error: string }[] = [];
  for (const stmt of REPAIR_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      applied++;
    } catch (e) {
      failures.push({ stmt: stmt.slice(0, 80), error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: failures.length === 0, applied, failures };
}
