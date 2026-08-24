import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { ingestSocialMetrics, type SocialMetricInput } from '@/lib/metrics/social-perf';

// Performance-loop ingest. The one door every source writes through: a Perch connector
// pull (see docs/perch-pull-runbook.md), a future automated adapter, or a backfill
// script. Manual entry goes through the same lib via a server action, not this route.
//
//   curl -X POST "$URL/api/metrics/social" \
//     -H "Authorization: Bearer $SYNC_SECRET" -H 'Content-Type: application/json' \
//     -d '{"rows":[{"source":"hootsuite:perch","publishedUrl":"https://www.instagram.com/p/ABC",
//                   "impressions":71000,"engagementRate":5.1,"windowDays":30}]}'
//
// Idempotent per (source, post, window, captured day) — re-POSTing the same body
// updates in place. `unmatched` in the response counts rows stored but tied to no known
// video, which is how a wrong permalink surfaces instead of the number vanishing.

export const runtime = 'nodejs'; // Prisma pg adapter needs Node, not edge
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_ROWS = 1000;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body must be JSON.' }, { status: 400 });
  }

  const rows = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json({ ok: false, error: 'Expected { rows: [...] }.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, error: `Too many rows (max ${MAX_ROWS}).` }, { status: 400 });
  }
  const bad = rows.findIndex((r) => {
    const s = (r as SocialMetricInput)?.source;
    return s !== 'manual' && s !== 'hootsuite:perch';
  });
  if (bad !== -1) {
    return NextResponse.json(
      { ok: false, error: `rows[${bad}].source must be 'manual' or 'hootsuite:perch'.` },
      { status: 400 },
    );
  }

  try {
    const report = await ingestSocialMetrics(rows as SocialMetricInput[]);
    // Nothing landed but something went wrong → a failure, not a quiet success. Split
    // by whose fault it was so a caller can act: 500 = our database, 400 = every row was
    // unusable. A partial batch stays 200 with `errors` populated.
    if (report.upserted === 0 && report.writeErrors > 0) {
      return NextResponse.json({ ok: false, ...report }, { status: 500 });
    }
    if (report.upserted === 0 && report.skipped > 0) {
      return NextResponse.json({ ok: false, ...report }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
