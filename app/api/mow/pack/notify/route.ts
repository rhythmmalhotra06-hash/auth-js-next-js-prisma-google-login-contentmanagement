import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { postToChannel, contentReadyChannel } from '@/lib/notify/slack';
import { composePackMessage } from '@/lib/mow/slack-pack';
import { utcDay, weekStartOf, addDays } from '@/lib/mow/week';

// The Monday pack → Slack (decision S11).
//
// Driven by .github/workflows/mow-pack-slack.yml at 00:00 UTC Monday = 08:00 MYT, the moment the
// meeting starts. `?dryRun=1` composes without posting, so the wording can be read before it lands
// in a channel — the same affordance the social digest has, and the reason its wording is good.
//
//   curl -X POST "$URL/api/mow/pack/notify?dryRun=1" -H "Authorization: Bearer $SYNC_SECRET"
//
// Defaults to the week that just ENDED, not the current one: at 08:00 on Monday the interesting
// week is the one being reviewed, and `new Date()` would resolve to the week that started eight
// hours ago and contains nothing.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const channel = url.searchParams.get('channel') || contentReadyChannel();
  const weekOf = url.searchParams.get('weekOf');

  let anchor: Date;
  try {
    anchor = weekOf ? utcDay(weekOf) : addDays(weekStartOf(new Date()), -7);
  } catch {
    return NextResponse.json({ ok: false, error: 'weekOf must be YYYY-MM-DD.' }, { status: 400 });
  }

  // Resolving the PUBLIC url is fiddlier than it looks, and the dry run caught it: the message
  // shipped a link to `https://localhost:8080/...`.
  //
  // `NEXT_PUBLIC_*` is inlined at BUILD time, so it is not reliably present in a server route at
  // runtime; and `url.origin` on Cloud Run is the container's own internal origin, not the address
  // anyone can click. `AUTH_URL` is a plain runtime var already set to the deployed URL — it is
  // what OAuth callbacks use, so if it were wrong login would be broken and someone would know.
  const appUrl =
    process.env.NEXT_PUBLIC_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    url.origin;

  try {
    const msg = await composePackMessage(anchor, appUrl);
    if (!dryRun && msg.worthPosting) await postToChannel(channel, msg.text);
    return NextResponse.json({
      ok: true,
      dryRun,
      channel: dryRun ? undefined : channel,
      posted: !dryRun && msg.worthPosting,
      text: msg.text,
    });
  } catch (err) {
    // S11: a Slack failure is reported and changes nothing else. Nothing downstream depends on it.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
