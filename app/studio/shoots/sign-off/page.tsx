import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyFine, EmptyOwned } from '@/components/ui/Empty';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getPendingShoots } from '@/lib/studio/data';
import { cn } from '@/lib/cn';

// /studio/shoots/sign-off — shoots awaiting Vishen, and nothing else.
//
// The blocker card used to send these to `/studio/sign-off`, which is the VIDEO REVIEW QUEUE
// ("video work in review — group, sort and filter like a spreadsheet"). Clicking "Review" on a
// shoot landed on a grid of unrelated edits, so the one thing being asked for was nowhere on the
// page you were sent to.
//
// This is deliberately not a grid. It is a short list of decisions, pre-filtered to
// `Filming Status = Needs Vishen's Review`, with the brief and the date visible without a click —
// because the question is "do I approve this shoot", not "let me explore my shoots".

export const dynamic = 'force-dynamic';

const fmtDate = (d: string | null): string | null =>
  d
    ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
      })
    : null;

export default async function ShootSignOffPage() {
  await requireStudioAccess();

  const studio = await loadStudio();
  const pending = getPendingShoots(studio.shoots);

  return (
    <AppShell
      title="Shoots waiting on you"
      subtitle={pending.length ? `${pending.length} awaiting your sign-off` : undefined}
    >
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/studio" className="text-[12.5px] font-medium text-brand hover:underline">
            ← Back to your media
          </Link>
          <Link href="/shoots" className="text-[12.5px] font-medium text-brand hover:underline">
            All shoots →
          </Link>
        </div>

        {pending.length === 0 ? (
          // Nothing waiting is good news and must not wear an alarm.
          <div className="rounded-md border border-border-default bg-surface px-4 py-6 text-center">
            <EmptyFine>No shoots are waiting on your sign-off.</EmptyFine>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((s) => (
              <div key={s.id} className="rounded-md border border-border-default bg-surface p-[18px]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-base font-bold leading-snug tracking-[-.01em] text-pretty">
                      {s.title ?? '(untitled shoot)'}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {s.format ? <Badge tone="neutral" dot={false}>{s.format}</Badge> : null}
                      {s.platforms.map((p) => (
                        <Badge key={p} tone="neutral" dot={false}>{p}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* The date is the decision-relevant fact, so it is large and to the right. */}
                  <div
                    className={cn(
                      'flex-none rounded-sm border px-3 py-2 text-right',
                      s.filmingDate ? 'border-warning bg-warning-soft' : 'border-border-default',
                    )}
                  >
                    <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                      Filming
                    </div>
                    {s.filmingDate ? (
                      <div className="mt-0.5 text-[13px] font-bold text-warning-content">
                        {fmtDate(s.filmingDate)}
                      </div>
                    ) : (
                      <div className="mt-0.5">
                        <EmptyOwned kind="notSet" owner="no date yet" />
                      </div>
                    )}
                  </div>
                </div>

                {s.filmingLocation ? (
                  <div className="mt-3 text-xs text-text-muted">{s.filmingLocation}</div>
                ) : null}

                {s.brief ? (
                  <p className="mt-3 max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-pretty">
                    {s.brief}
                  </p>
                ) : (
                  <div className="mt-3">
                    <EmptyOwned kind="notSet" owner="no brief written" />
                  </div>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-border-default pt-3">
                  <Link
                    href={`/shoots/${s.id}`}
                    className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-2xs font-semibold text-text hover:bg-bg-subtle"
                  >
                    Open the shoot
                  </Link>
                  {/*
                    Approval happens in Airtable, not here. The portal proposes and humans commit,
                    and "Vishen's Approval" is a checkbox the team owns — the app does not tick it.
                  */}
                  <span className="text-2xs text-text-subtle">
                    Sign-off is the “Vishen’s Approval” checkbox in Airtable — this page is the
                    queue, not the switch.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
