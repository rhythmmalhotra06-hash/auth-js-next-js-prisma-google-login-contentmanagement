import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { generatePack } from '@/lib/mow/pack';
import { utcDay } from '@/lib/mow/week';

// Generate the Monday MOW pack for a week.
//
//   curl -X POST "$URL/api/mow/pack/generate?weekOf=2026-09-08" \
//     -H "Authorization: Bearer $SYNC_SECRET"
//
// Driven by .github/workflows/mow-monday-pack.yml, plus a manual Sunday-night trigger —
// GitHub Actions cron slips 3–11h in this repo, so the Monday 08:00 MYT fire must never be the
// only path to a pack existing.
//
// PROPOSE-ONLY and idempotent: only `*Staged` fields are written, so a re-run can never
// overwrite what a human committed. Safe to fire repeatedly.
//
// It deliberately does NOT fetch metrics. Values arrive via /api/mow/metrics/ingest, so a
// failed metrics run yields a pack with an honest empty number rather than no pack at all.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get('weekOf');
  let weekOf: Date;
  try {
    weekOf = raw ? utcDay(raw) : new Date();
  } catch {
    return NextResponse.json({ ok: false, error: 'weekOf must be YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const report = await generatePack({ weekOf });
    // Warnings are not failures — an empty week is a real state worth reporting loudly (it
    // usually means the Airtable backfill hasn't happened) but the pack still generated.
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
