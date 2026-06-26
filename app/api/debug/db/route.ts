import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// TEMPORARY diagnostic — what does the APP's own Prisma connection actually see?
// Read-only; behind IAP. Remove once the ticket.create column issue is resolved.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    const db = await prisma.$queryRaw<{ db: string; usr: string }[]>`SELECT current_database() AS db, current_user AS usr`;
    out.connection = db[0];
  } catch (e) {
    out.connectionError = e instanceof Error ? e.message : String(e);
  }
  try {
    const col = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='tickets' AND column_name='airtable_pushed_at'
      ) AS exists`;
    out.airtablePushedAtColumnVisible = col[0]?.exists ?? null;
  } catch (e) {
    out.columnCheckError = e instanceof Error ? e.message : String(e);
  }
  // Exercise the exact read path the failing create's RETURNING would use.
  try {
    await prisma.ticket.findFirst({ select: { id: true, airtablePushedAt: true } });
    out.prismaSelectAirtablePushedAt = 'ok';
  } catch (e) {
    out.prismaSelectAirtablePushedAt = e instanceof Error ? e.message : String(e);
  }
  try {
    const c = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM airtable_outbox`;
    out.outboxRows = Number(c[0]?.n ?? 0);
  } catch (e) {
    out.outboxError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
