import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { sendSocialDigest } from '@/lib/metrics/social-digest';

// Weekly social performance digest → Slack. Driven by
// .github/workflows/social-digest.yml; `?dryRun=1` composes it without posting, so the
// wording can be checked before it lands in a channel.
//
//   curl -X POST "$URL/api/metrics/social-digest?dryRun=1" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const channel = url.searchParams.get('channel') ?? undefined;

  try {
    const r = await sendSocialDigest({ dryRun, channel });
    // Nothing to say is a success, not a failure — a digest that errors on a quiet week
    // gets its schedule switched off.
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
