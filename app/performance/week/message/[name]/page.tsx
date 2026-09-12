import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Skel } from '@/components/ui/Skeletons';
import { MessageWeekView } from '@/components/mow/MessageWeek';
import { getWeekPack } from '@/lib/mow/week-pack';
import { messageWeek, emailTargets, withEmailResults } from '@/lib/mow/message-week';
import { getEmailResults } from '@/lib/braze/results';
import { utcDay, weekStartOf, weekBounds, toYmd } from '@/lib/mow/week';

// /performance/week/message/[name] — one message's week.
//
// "I should be able to click on Expert to Authority and see everything that happened for it
// last week with results." The brand card names the message; this is where clicking it lands.
// Everything under the message — Mindvalley posts and emails, Vishen assets — grouped by day,
// with platform, artwork, the live link, and the Perch result where one matched.
//
// It is a SELECTION over the same pack the week page builds (memoised per week), so it costs
// no extra Airtable read. The route param is the message's display name, which is what the card
// showed; a name that matches nothing this week renders as a quiet empty, never a 404.

export const dynamic = 'force-dynamic';

export default async function MessageWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ name: rawName }, sp] = await Promise.all([params, searchParams]);
  const name = decodeURIComponent(rawName);

  let anchor: Date;
  try {
    anchor = sp.week ? utcDay(sp.week) : new Date();
  } catch {
    anchor = new Date();
  }
  const start = weekStartOf(anchor);
  const { end } = weekBounds(start);
  const range = `${start.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
  const weekHref = toYmd(start);

  return (
    <AppShell title={name} subtitle={`Week of ${range}`}>
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/performance/week?week=${weekHref}`} className="text-[12.5px] font-medium text-brand hover:underline">
            ← Back to the week
          </Link>
          <Link href={`/studio/comms-calendar?week=${weekHref}`} className="text-[12.5px] font-medium text-brand hover:underline">
            Open the calendar →
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skel height={18} width={360} />
              {Array.from({ length: 5 }).map((_, i) => <Skel key={i} height={88} />)}
            </div>
          }
        >
          <Body anchor={anchor} name={name} weekHref={weekHref} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function Body({ anchor, name, weekHref }: { anchor: Date; name: string; weekHref: string }) {
  let error: string | null = null;
  let data: ReturnType<typeof messageWeek> | null = null;
  try {
    const pack = await getWeekPack(anchor);
    data = messageWeek(pack.week, name, pack.days);
    // Braze numbers for the email rows. Best-effort and separate from the pack: an empty
    // `email_metrics` (no key yet, or a week before the pull started) leaves the rows reading
    // "no Braze campaign matched", which is what they said before this existed.
    const targets = emailTargets(data);
    if (targets.length) {
      const results = await getEmailResults(targets, { from: pack.week.weekStart, to: pack.week.weekEnd })
        .catch(() => null);
      if (results) data = withEmailResults(data, results.byEmail, results.state);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
        <div className="text-[13.5px] font-semibold text-danger-content">Could not read the week</div>
        <div className="mt-1 text-xs text-text-muted">{error ?? 'No data was produced.'}</div>
      </div>
    );
  }
  return <MessageWeekView data={data} weekHref={weekHref} />;
}
