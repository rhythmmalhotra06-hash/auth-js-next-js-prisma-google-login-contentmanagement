import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyOwned, EmptyFine } from '@/components/ui/Empty';
import { getAssetDetail } from '@/lib/comms-calendar/asset';
import { cn } from '@/lib/cn';

// Asset detail — artboard `5b`.
//
// `Live Date` is PROMOTED to its own bordered block at 22px/700, up from 15px in a corner. That is
// the design's single biggest change here and it is an argument about the data, not the layout:
// this is the field the whole calendar hinges on, it has no owner, and 204 of 442 assets lack it
// with 66 of those already published. Burying it was understating the problem.
//
// Every absence on this page names who closes it, and none of them renders as a zero — the 24-hour
// read in particular is empty on every published asset in the base, and "not filled" is a
// different statement from "0".

export const dynamic = 'force-dynamic';

/** One labelled field. `owner` turns an absence into an action rather than a blank. */
function Field({
  label,
  value,
  owner,
  fine,
}: {
  label: string;
  value: string | null;
  /** Named when someone owns filling this in; omitted when the blank is simply ordinary. */
  owner?: string | null;
  /** True when absence is fine and must NOT look like a gap (tier 2). */
  fine?: boolean;
}) {
  return (
    <div>
      <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{label}</div>
      <div className="mt-1">
        {value !== null ? (
          <span className="text-[13px] leading-snug text-pretty">{value}</span>
        ) : fine ? (
          <EmptyFine />
        ) : (
          <EmptyOwned kind="notSet" owner={owner} />
        )}
      </div>
    </div>
  );
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brand?: string; week?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = `/studio/comms-calendar?brand=${sp.brand ?? 'main'}${sp.week ? `&week=${sp.week}` : ''}`;

  let asset: Awaited<ReturnType<typeof getAssetDetail>> = null;
  let error: string | null = null;
  try {
    asset = await getAssetDetail(id);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <AppShell title="Asset" subtitle={asset?.title}>
      <div className="flex flex-col gap-[22px]">
        <Link href={backHref} className="text-[12.5px] font-medium text-brand hover:underline">
          ← Back to the calendar
        </Link>

        {error ? (
          <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
            <div className="text-[13.5px] font-semibold text-danger-content">Could not read the asset</div>
            <div className="mt-1 text-xs text-text-muted">{error}</div>
          </div>
        ) : !asset ? (
          <div className="rounded-md border border-border-default bg-surface px-4 py-3">
            <div className="text-[13.5px] font-semibold">No such asset</div>
            <div className="mt-1 text-xs text-text-muted">
              It may have been deleted in Airtable since the calendar was read.
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-border-default bg-surface p-[18px]">
              <div className="flex flex-wrap items-center gap-2">
                {/* VL teal on every surface — this is a Vishen-lane record by construction. */}
                <Badge tone="vishen">{asset.brandLabel ?? 'Vishen Lakhiani Media'}</Badge>
                {asset.status ? (
                  <Badge tone={asset.published ? 'success' : 'neutral'}>{asset.status}</Badge>
                ) : null}
              </div>

              <h2 className="mt-3 font-display text-xl font-bold leading-[1.25] tracking-[-.02em] text-pretty">
                {asset.title}
              </h2>

              {/* ── THE promoted field ──────────────────────────────────────── */}
              <div
                className={cn(
                  'mt-[22px] rounded-sm border p-3.5',
                  asset.liveDate ? 'border-border-strong bg-surface' : 'border-staged bg-staged-soft',
                )}
              >
                <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                  Live date
                </div>
                {asset.liveDate ? (
                  <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-.02em]">
                    {new Date(`${asset.liveDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
                    })}
                  </div>
                ) : (
                  <>
                    <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-.02em] text-staged-content">
                      Not dated
                    </div>
                    <div className="mt-1.5 text-xs leading-relaxed text-text-muted">
                      No calendar can place this asset until a Live Date is set.{' '}
                      <span className="font-semibold">Live Date has no owner</span> — it is the single
                      field that would empty the not-dated tray.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── The week's message it inherits ──────────────────────────── */}
            <section>
              <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Message and goal
              </h3>
              <div className="grid gap-3 rounded-md border border-border-default bg-surface p-[18px] sm:grid-cols-2">
                <Field label="Message of the week" value={asset.messageName} owner="Ramya" />
                <Field label="Goal" value={asset.goal} owner="Ramya" />
              </div>
            </section>

            {/* ── Production and delivery ─────────────────────────────────── */}
            <section>
              <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Production
              </h3>
              <div className="grid gap-4 rounded-md border border-border-default bg-surface p-[18px] sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Channel" value={asset.channel} fine />
                <Field label="Source" value={asset.source} fine />
                <Field label="Approval" value={asset.approval} owner="Ramya or Vishen" />
                <div>
                  <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                    Published link
                  </div>
                  <div className="mt-1">
                    {asset.publishedUrl ? (
                      <a
                        href={asset.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-[13px] font-medium text-brand hover:underline"
                      >
                        {asset.publishedUrl}
                      </a>
                    ) : asset.published ? (
                      // Published but no link recorded — a real gap with a real owner (U8).
                      <EmptyOwned kind="notSet" owner="no publish link recorded · Glen" />
                    ) : (
                      <EmptyFine>Not published yet</EmptyFine>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                    24-hour read
                  </div>
                  <div className="mt-1">
                    {asset.read24h ? (
                      <span className="text-[13px] leading-snug text-pretty">{asset.read24h}</span>
                    ) : (
                      // "Not filled" is a different claim from "0". This field is empty on every
                      // published asset in the base, so a zero here would be pure fabrication.
                      <EmptyOwned kind="notFilled" />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Siblings, if the message links any ─────────────────────── */}
            <section>
              <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Others on this message
              </h3>
              {asset.messageName === null ? (
                <div className="rounded-md border border-border-default bg-surface px-4 py-3">
                  <EmptyOwned kind="noMessage" />
                  <div className="mt-1.5 text-xs text-text-muted">
                    Without a message there is nothing to group this asset with.
                  </div>
                </div>
              ) : asset.siblings.length === 0 ? (
                <div className="rounded-md border border-border-default bg-surface px-4 py-3">
                  {/* No dashed box — it reads as a component that failed to load. */}
                  <EmptyFine>This is the only asset on this message.</EmptyFine>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border-default bg-surface">
                  {asset.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/studio/comms-calendar/asset/${s.id}?brand=${sp.brand ?? 'main'}${sp.week ? `&week=${sp.week}` : ''}`}
                      className="flex items-center gap-3 border-b border-border-default px-4 py-2.5 last:border-b-0 hover:bg-bg-subtle"
                    >
                      <span
                        aria-hidden
                        className={cn('h-1.5 w-1.5 flex-none rounded-full', s.published ? 'bg-success' : 'bg-border-default')}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{s.title}</span>
                      <span className="flex-none text-2xs text-text-subtle">
                        {s.liveDate
                          ? new Date(`${s.liveDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', timeZone: 'UTC',
                            })
                          : 'not dated'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="text-2xs text-text-subtle">
              Read-only. Every field here is edited in Airtable.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
