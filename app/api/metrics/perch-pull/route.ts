import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { pullPerchMetrics } from '@/lib/hootsuite/perch';

// Scheduled Hootsuite Perch pull — the automated source for the performance loop.
// Driven by .github/workflows/perch-metrics.yml, same bearer convention as the other jobs.
//
//   curl -X POST "$URL/api/metrics/perch-pull?windowDays=30" \
//     -H "Authorization: Bearer $SYNC_SECRET"
//
// Idempotent: rows are keyed by (source, post, window, captured day), so a re-run updates
// in place. The response carries `toolsSeen` / `toolsWithoutRows` because Perch's tool
// surface was undocumented at build time — an empty pull with tools listed means the
// extractor needs tightening, which is very different from "performance was zero".

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get('windowDays');
  const parsed = raw === null ? 30 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    return NextResponse.json({ ok: false, error: 'windowDays must be an integer between 1 and 365.' }, { status: 400 });
  }

  try {
    const report = await pullPerchMetrics(parsed);
    const failed = report.upserted === 0 && report.errors.length > 0;
    return NextResponse.json({ ok: !failed, windowDays: parsed, ...report }, { status: failed ? 502 : 200 });
  } catch (err) {
    // Most likely: not connected, or the grant was revoked. Both need a human at
    // /admin/hootsuite, so say so plainly instead of returning a bare 500.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
