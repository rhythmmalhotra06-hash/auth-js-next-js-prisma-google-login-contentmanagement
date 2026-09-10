import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { AssetsTable, AssetsFootnotes } from '@/components/mow/AssetsTable';
import { getWeekAssets } from '@/lib/mow/week-assets';
import { utcDay, weekStartOf, addDays, toYmd } from '@/lib/mow/week';

// /performance/week/assets — artboard `4a`. The meeting's roll-up.
//
// Every owner's delivered work for the week, grouped by owner and deliberately NOT personalised
// (U6). "Who made what, and where did it go" is the question Vision could never answer from Jira
// plus four Airtable bases, and it is the reason this page exists rather than a per-editor view.
//
// Same access posture as the pack and the calendar: signed in, not founder-gated. Glen, Gareth,
// Ramya and the editors all read it.

export const dynamic = 'force-dynamic';

export default async function WeekAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;

  let anchor: Date;
  try {
    anchor = sp.week ? utcDay(sp.week) : new Date();
  } catch {
    anchor = new Date();
  }
  const start = weekStartOf(anchor);
  const prev = toYmd(addDays(start, -7));
  const next = toYmd(addDays(start, 7));

  let week: Awaited<ReturnType<typeof getWeekAssets>> | null = null;
  let error: string | null = null;
  try {
    week = await getWeekAssets(anchor);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const range = week
    ? `${new Date(`${week.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${new Date(`${week.weekEnd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
    : '';

  return (
    <AppShell title="What we delivered" subtitle={range || undefined}>
      {error ? (
        <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
          <div className="text-[13.5px] font-semibold text-danger-content">Could not load the week</div>
          <div className="mt-1 text-xs text-text-muted">{error}</div>
        </div>
      ) : week ? (
        <div className="flex flex-col gap-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={`/performance/week?week=${toYmd(start)}`}
                    className="text-[12.5px] font-medium text-brand hover:underline">
                ← The week
              </Link>
              <Link href={`/performance/week/assets?week=${prev}`}
                    className="ml-2 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle">
                ← Previous
              </Link>
              <Link href={`/performance/week/assets?week=${next}`}
                    className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle">
                Next →
              </Link>
            </div>
            <span className="text-2xs text-text-subtle">
              {week.total} delivered across {week.groups.length}{' '}
              {week.groups.length === 1 ? 'owner' : 'owners'} · as of{' '}
              {new Date(week.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <AssetsTable week={week} />
          <AssetsFootnotes week={week} />
        </div>
      ) : null}
    </AppShell>
  );
}
