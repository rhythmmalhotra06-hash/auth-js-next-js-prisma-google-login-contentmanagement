import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { NotDatedTray } from '@/components/comms-calendar/NotDatedTray';
import { getNotDatedTray, type TrayGrouping } from '@/lib/comms-calendar/not-dated';

// /studio/comms-calendar/not-dated — artboard `6b`.
//
// Every Vishen-lane asset with no Live Date. The design handoff calls this "the largest single
// body of work in the system"; in the export it was a `Show all 221` button and nothing else.
//
// It is a separate route rather than an expander on the calendar because it answers a different
// question — the calendar asks "what goes out when", and this asks "what can never be placed at
// all". Its own URL also means it can be linked to from Slack, which is how it will actually get
// in front of the person who can fix it.

export const dynamic = 'force-dynamic';

export default async function NotDatedPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string; brand?: string; week?: string }>;
}) {
  const sp = await searchParams;
  const grouping: TrayGrouping =
    sp.by === 'status' || sp.by === 'channel' ? sp.by : 'source';

  const back = `/studio/comms-calendar?brand=${sp.brand ?? 'main'}${sp.week ? `&week=${sp.week}` : ''}`;

  let tray: Awaited<ReturnType<typeof getNotDatedTray>> | null = null;
  let error: string | null = null;
  try {
    tray = await getNotDatedTray(grouping);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <AppShell
      title="Not dated"
      subtitle={tray ? `${tray.counts.undated} assets the calendar cannot place` : undefined}
    >
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={back} className="text-[12.5px] font-medium text-brand hover:underline">
            ← Back to the calendar
          </Link>
          {tray ? (
            <span className="text-2xs text-text-subtle">
              read live from Airtable, as of{' '}
              {new Date(tray.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
            <div className="text-[13.5px] font-semibold text-danger-content">Could not read the tray</div>
            <div className="mt-1 text-xs text-text-muted">{error}</div>
          </div>
        ) : tray ? (
          <NotDatedTray
            tray={tray}
            hrefFor={(g) =>
              `/studio/comms-calendar/not-dated?by=${g}${sp.brand ? `&brand=${sp.brand}` : ''}${sp.week ? `&week=${sp.week}` : ''}`
            }
          />
        ) : null}

        <p className="text-2xs text-text-subtle">
          Read-only. Live Date is set in Airtable.
        </p>
      </div>
    </AppShell>
  );
}
