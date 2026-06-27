import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getQueueTickets, getActiveEmployees } from '@/lib/tickets/data';
import { loadMap, riskOf, dueDays } from '@/lib/tickets/intel';

export const runtime = 'nodejs';

// "Ask the brain" — propose-only answers computed from real queue data.
// No fabricated performance: performance questions return an honest deferral.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ answer: 'Please sign in.' }, { status: 401 });

  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  const s = (q ?? '').toLowerCase().trim();
  if (!s) return NextResponse.json({ answer: 'Ask me about capacity, blockers, what’s at risk, or the queue.' });

  const [tickets, employees] = await Promise.all([
    getQueueTickets({ includeCompleted: true }),
    getActiveEmployees().catch(() => []),
  ]);
  const active = tickets.filter((t) => !['Done', "Won't Do"].includes(t.ticketStatus ?? ''));
  const load = loadMap(tickets);
  const has = (...k: string[]) => k.some((w) => s.includes(w));

  let answer: string;
  if (has('capacity', 'who should', 'assign', 'workload', 'bandwidth', 'free')) {
    const ranked = employees.map((e) => ({ n: e.name, l: load.get(e.name) ?? 0 })).sort((a, b) => a.l - b.l);
    if (!ranked.length) answer = 'No active employees are loaded — capacity data unavailable.';
    else {
      const top = ranked[0];
      const list = ranked.slice(0, 6).map((x) => `${x.n.split(' ')[0]} ${x.l}/4`).join(' · ');
      answer = `**${top.n}** has the most room — ${top.l}/4 active. Current load: ${list}.`;
    }
  } else if (has('perform', 'ctr', 'roas', 'views', 'how did', 'results')) {
    answer = 'Performance metrics (CTR / ROAS / views) aren’t wired yet — they arrive in a later phase once distribution links and Clarisights/Amplitude are connected. For now I can answer on capacity, blockers, risk, and the queue.';
  } else if (has('block', 'stuck', 'waiting', 'approval', 'review')) {
    const blocked = active.filter((t) => ['To be reviewed by Vishen', 'Pending Information/Brief Not Clear'].includes(t.prioStatus ?? '') || t.ticketStatus === 'Review');
    answer = blocked.length
      ? `**${blocked.length}** waiting on a decision: ${blocked.slice(0, 5).map((t) => `${t.title} (${t.prioStatus ?? t.ticketStatus})`).join('; ')}.`
      : 'Nothing is blocked on review or approval right now.';
  } else if (has('risk', 'slip', 'overdue', 'late', 'behind', 'due')) {
    const risky = active.map((t) => ({ t, r: riskOf(t, load) })).filter((x) => x.r.level);
    answer = risky.length
      ? `**${risky.length}** at risk: ${risky.slice(0, 5).map((x) => `${x.t.title} — ${x.r.why[0]}`).join('; ')}.`
      : 'Nothing is flagged at risk — everything is tracking to its due date.';
  } else {
    const unassigned = active.filter((t) => !t.assignee).length;
    const dueSoon = active.filter((t) => { const d = dueDays(t.dueDate); return d != null && d >= 0 && d <= 3; }).length;
    answer = `Right now: **${active.length}** active requests, **${unassigned}** unassigned, **${dueSoon}** due within 3 days, **${tickets.length - active.length}** completed. Ask me about capacity, blockers, or what’s at risk.`;
  }

  return NextResponse.json({ answer });
}
