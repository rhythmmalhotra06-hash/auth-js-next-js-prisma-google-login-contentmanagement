import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { prisma } from '@/lib/prisma';
import { getWeekPack } from '@/lib/mow/week-pack';
import { utcDay, weekStartOf, addDays } from '@/lib/mow/week';

// Draft learnings from the week's computed facts, for a human to edit and commit.
//
// Decision AA2: the system may PROPOSE, a person commits. Every row written here carries
// `proposed = true`, which the UI renders as "Proposed by the system" — and editing one clears the
// flag, because a human has then put their name behind the words.
//
// WHAT IT WILL AND WILL NOT SAY. Glen's condition was specific: "if efficiency is a recommendation
// and that's not true, it might derail everything". So these are drafted from FACTS the pack
// already computed — the standout post and its real reach, days with nothing recorded, the
// measurement gap — and each one ends in a question or a lever rather than an assertion about why
// something worked. The system does not know why. It knows what happened.
//
//   curl -X POST "$URL/api/mow/learnings/propose?weekOf=2026-09-07" \
//     -H "Authorization: Bearer $SYNC_SECRET"
//
// Idempotent: a proposal whose text already exists on the week is skipped, so a re-run after
// someone has edited or committed one does not resurrect it.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const weekOf = url.searchParams.get('weekOf');
  const dryRun = url.searchParams.get('dryRun') === '1';

  let anchor: Date;
  try {
    anchor = weekOf ? utcDay(weekOf) : addDays(weekStartOf(new Date()), -7);
  } catch {
    return NextResponse.json({ ok: false, error: 'weekOf must be YYYY-MM-DD.' }, { status: 400 });
  }

  const pack = await getWeekPack(anchor);
  const weekStart = weekStartOf(anchor);

  // Proposals are per-brand-week, and only Mindvalley has the post data behind them today.
  const target = pack.brandState.find((b) => b.brand === 'MV') ?? pack.brandState[0];
  if (!target) {
    return NextResponse.json({ ok: false, error: 'No MOW week to attach learnings to.' }, { status: 404 });
  }
  if (target.committed) {
    return NextResponse.json({ ok: true, skipped: 'week already committed', created: [] });
  }

  const b = pack.briefing;
  const drafts: { text: string; leverOwner: string }[] = [];

  if (b.standout) {
    drafts.push({
      text:
        `“${b.standout.title}” reached ${b.standout.reach.toLocaleString('en-US')} on ` +
        `${b.standout.platforms.join(' and ') || 'social'} — the week's highest. ` +
        `Worth deciding whether the format repeats, or whether this was the subject rather than the format.`,
      leverOwner: 'format → the lane that made it',
    });
  }

  if (b.misses.length) {
    drafts.push({
      text:
        `${b.misses.map((m) => m.weekday).join(', ')} planned work and nothing was recorded against ` +
        `${b.misses.length === 1 ? 'it' : 'them'}. Confirm whether the work went out untracked or did not go out.`,
      leverOwner: 'publish links → whoever schedules the day',
    });
  }

  const matched = pack.week.allPosts.filter((p) => p.results?.reach).length;
  const total = pack.week.allPosts.length;
  if (total && matched < total) {
    drafts.push({
      text:
        `${total - matched} of ${total} posts this week have no numbers, because the caption saved in ` +
        `Airtable is a briefing note rather than the copy that published. Pasting the published ` +
        `caption back would make them measurable.`,
      leverOwner: 'caption field → the scheduler',
    });
  }

  if (b.formats.length && b.formatCoverage.named >= 3) {
    const top = b.formats[0];
    drafts.push({
      text:
        `${top.count} of ${b.formatCoverage.named} titled posts were ${top.name}. ` +
        `Is that the intended mix for this message, or what was easiest to make?`,
      leverOwner: 'format mix → the message owner',
    });
  }

  // Never resurrect something a human has already dealt with.
  const existing = await prisma.learning.findMany({
    where: { weekId: target.weekId },
    select: { textStaged: true, textCommitted: true },
  });
  const seen = new Set(existing.flatMap((l) => [l.textStaged, l.textCommitted].filter(Boolean) as string[]));
  const fresh = drafts.filter((d) => !seen.has(d.text));

  if (!dryRun) {
    let rank = existing.length;
    for (const d of fresh) {
      await prisma.learning.create({
        data: {
          weekId: target.weekId,
          textStaged: d.text,
          leverOwner: d.leverOwner,
          proposed: true,
          rank: rank++,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    weekStart: weekStart.toISOString().slice(0, 10),
    brand: target.brand,
    dryRun,
    created: fresh.map((d) => d.text),
    skippedAsDuplicate: drafts.length - fresh.length,
  });
}
