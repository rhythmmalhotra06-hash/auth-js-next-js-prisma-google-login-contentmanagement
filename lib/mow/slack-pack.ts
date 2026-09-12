// The Monday pack, as a Slack message.
//
// Decision S11: the pack lives on the page AND goes to Slack, because the link is what actually
// gets the room to open the page at 08:00. It is a POINTER with enough substance to be worth
// reading on a phone — the headline, what is blocked, what is thin next week — not a copy of the
// report. Anything longer and people read the message instead of the page, which defeats it.
//
// Two rules carried from the surface it summarises:
//   • organic-social revenue and email revenue are named separately and NEVER summed (AB3)
//   • a figure that is not there says so; nothing here renders a zero it does not have
//
// Best-effort by construction: a commit must never depend on Slack being up (S11), so a failure
// here is reported to the caller and changes nothing else.

import { prisma } from '@/lib/prisma';
import { weekStartOf, toYmd, addDays } from './week';
import type { SmartNumber } from './smart-number';

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

function fmtRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const a = weekStart.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const b = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return `${a}–${b}`;
}

export interface PackMessage {
  text: string;
  /** False when there is genuinely nothing to say — the caller should not post. */
  worthPosting: boolean;
}

/**
 * Compose the message from what is actually in the week.
 *
 * Reads the SAME MowWeek rows the page renders, so the message cannot drift from the surface it
 * points at — the failure mode of a hand-written summary is that it is right on the day it was
 * written and wrong every week after.
 */
export async function composePackMessage(anchor: Date, appUrl: string): Promise<PackMessage> {
  const weekStart = weekStartOf(anchor);
  const weeks = await prisma.mowWeek.findMany({
    where: { weekStart },
    orderBy: { brand: 'asc' },
    include: { learnings: true },
  });

  const link = `${appUrl.replace(/\/$/, '')}/performance/week?week=${toYmd(weekStart)}`;
  const lines: string[] = [`*Message of the Week* · ${fmtRange(weekStart)}`];

  if (!weeks.length) {
    // Say the pack is empty rather than posting a cheerful link to nothing.
    return {
      text: `${lines[0]}\nNo pack has been generated for this week yet.\n${link}`,
      worthPosting: true,
    };
  }

  for (const w of weeks) {
    const n = (w.smartNumberCommitted ?? w.smartNumberStaged) as SmartNumber | null;
    const brand = w.brand === 'VL' ? 'Vishen' : 'Mindvalley';
    const state = w.committedAt ? `committed by ${w.committedBy?.split('@')[0] ?? 'someone'}` : 'not committed yet';

    if (w.message) lines.push(`\n*${brand}* — ${w.message}  _(${state})_`);
    else lines.push(`\n*${brand}* — no message committed  _(${state})_`);

    if (n?.value != null) {
      const target = n.target != null ? ` of ${n.targetProvenance === 'inferred' ? '~' : ''}${n.target.toLocaleString('en-US')}` : '';
      lines.push(`• ${n.label}: *${n.value.toLocaleString('en-US')}*${target}`);
    } else {
      lines.push('• No figure ingested for this week yet');
    }

    // Drivers, named separately. Social and email revenue are never added together.
    const drivers = Array.isArray(w.drivers)
      ? (w.drivers as { key: string; label: string; value: number | null }[])
      : [];
    for (const d of drivers) {
      if (d.value == null) continue;
      lines.push(`• ${d.label}: ${d.key.includes('revenue') ? money(d.value) : d.value.toLocaleString('en-US')}`);
    }

    const staged = w.learnings.filter((l) => !l.committedAt).length;
    const committed = w.learnings.filter((l) => l.committedAt).length;
    if (committed || staged) {
      lines.push(`• Learnings: ${committed} committed${staged ? `, ${staged} still staged` : ''}`);
    }
  }

  const uncommitted = weeks.filter((w) => !w.committedAt);
  if (uncommitted.length) {
    lines.push(
      `\n:warning: ${uncommitted.map((w) => (w.brand === 'VL' ? 'Vishen' : 'Mindvalley')).join(' and ')} ${uncommitted.length === 1 ? 'is' : 'are'} not committed — Gareth, Glen or Ramya can.`,
    );
  }

  lines.push(`\n${link}`);
  return { text: lines.join('\n'), worthPosting: true };
}
