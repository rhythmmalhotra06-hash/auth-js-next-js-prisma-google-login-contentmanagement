import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { pullBrazeEmailMetrics } from '@/lib/braze/pull';

// Scheduled Braze pull — the email half of the performance loop.
// Driven by .github/workflows/braze-metrics.yml, same bearer convention as the other jobs.
//
//   curl -X POST "$URL/api/metrics/braze-pull?sinceDays=14" \
//     -H "Authorization: Bearer $SYNC_SECRET"
//
// Idempotent: rows are keyed by (campaign, window, captured day), so a re-run updates in place.
//
// The response carries `unclassified` deliberately. Braze campaigns are bucketed to an audience
// list by their tags, and the map in lib/braze/pull.ts was seeded from the Marketing Ops hub's —
// which covers the newsletters and not the launch sequences. A name showing up here is not an
// error, it is the map asking to be extended, and it is the only way to learn what the workspace
// actually contains without guessing.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get('sinceDays');
  const sinceDays = raw === null ? 14 : Number(raw);
  if (!Number.isInteger(sinceDays) || sinceDays < 1 || sinceDays > 90) {
    return NextResponse.json({ ok: false, error: 'sinceDays must be an integer between 1 and 90.' }, { status: 400 });
  }

  try {
    const report = await pullBrazeEmailMetrics({ sinceDays });
    // Nothing written AND errors recorded means the pull failed; nothing written with no errors
    // is a quiet week, which is a different thing and must not page anyone.
    const failed = report.upserted === 0 && report.errors.length > 0;
    return NextResponse.json({ ok: !failed, sinceDays, ...report }, { status: failed ? 502 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
