import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { listClipSignals } from '@/lib/media/clip-signals';
import { listClipRules, createClipRule } from '@/lib/clip-rules/repository';
import { proposeLearnings, PROPOSED_NOTE_PREFIX, type ClipSignal } from '@/lib/clipping/learn';

// Tier-2 clip-learning loop: read released/rated clip signals, ask the engine to
// propose generalizable rules from what performed, and write them as INACTIVE
// "proposed" Clip Rules for an admin to approve in Settings → Clip Rules.
// Bearer-gated like the other sync endpoints; drive from a weekly Kessel cron.
//
//   curl -X POST "$URL/api/clips/learn" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Rating is a 1–5 star field; treat 4+ as a win and 2- as a miss.
const HIGH = 4;
const LOW = 2;

function authorized(req: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const sig = await listClipSignals();
    if (!sig.ok) return NextResponse.json({ ok: false, error: sig.error.message }, { status: 502 });

    const toSignal = (r: (typeof sig.data)[number]): ClipSignal => ({
      rating: r.rating,
      feedback: r.feedback,
      released: r.released,
    });
    const highs = sig.data.filter((r) => (r.rating ?? 0) >= HIGH).map(toSignal);
    const lows = sig.data.filter((r) => r.rating != null && r.rating <= LOW).map(toSignal);

    if (!highs.length && !lows.length) {
      return NextResponse.json({ ok: true, proposed: 0, note: 'No rated clips to learn from yet.' });
    }

    // Don't re-propose what's already stored (active rules) or already proposed (awaiting approval).
    const rulesRes = await listClipRules();
    const existing = rulesRes.ok
      ? rulesRes.data.filter((r) => r.kind === 'Rule' && r.content?.trim()).map((r) => r.content!.trim())
      : [];

    const learnings = await proposeLearnings(highs, lows, existing);
    if (!learnings.length) return NextResponse.json({ ok: true, proposed: 0 });

    let proposed = 0;
    for (const l of learnings) {
      const res = await createClipRule({
        name: l.rule.slice(0, 60),
        content: l.rule,
        clipType: l.clipType,
        section: l.section,
        note: `${PROPOSED_NOTE_PREFIX} — ${l.evidence}`.slice(0, 500),
        active: false, // awaits admin approval in Settings
      });
      if (res.ok) proposed++;
    }

    return NextResponse.json({ ok: true, proposed, considered: highs.length + lows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
