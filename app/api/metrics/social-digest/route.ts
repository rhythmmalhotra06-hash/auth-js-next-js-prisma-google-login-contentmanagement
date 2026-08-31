import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { sendSocialDigest } from '@/lib/metrics/social-digest';

// Social performance digest → Slack. Driven by .github/workflows/social-digest.yml
// (Monday, last 30 days) and social-digest-weekly.yml (Wednesday, last 7 days);
// `?dryRun=1` composes it without posting, so the wording can be checked before it lands
// in a channel.
//
//   curl -X POST "$URL/api/metrics/social-digest?dryRun=1" -H "Authorization: Bearer $SYNC_SECRET"
//   curl -X POST "$URL/api/metrics/social-digest?windowDays=7" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const channel = url.searchParams.get('channel') ?? undefined;
  const rawWindow = url.searchParams.get('windowDays');
  const windowDays = rawWindow === null ? 30 : Number(rawWindow);
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
    return NextResponse.json({ ok: false, error: 'windowDays must be an integer between 1 and 365.' }, { status: 400 });
  }

  try {
    const r = await sendSocialDigest({ dryRun, channel, windowDays });
    // Nothing to say is a success, not a failure — a digest that errors on a quiet week
    // gets its schedule switched off.
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
