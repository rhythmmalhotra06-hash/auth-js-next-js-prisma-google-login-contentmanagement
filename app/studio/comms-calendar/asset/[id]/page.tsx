import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyOwned, EmptyFine, type Tier1Key } from '@/components/ui/Empty';
import { getAssetDetail } from '@/lib/comms-calendar/asset';
import { getBenchmarks, compareAsset, type AssetComparison } from '@/lib/comms-calendar/benchmark';
import { cn } from '@/lib/cn';

// Asset detail — artboard `5b`, rebuilt to the approved prototype.
//
// ── THE LAYOUT IS THE SPEC ────────────────────────────────────────────────────────────────────
//
// One record card: the title left, LIVE DATE top-right, then a FLAT grid of labelled fields. The
// version this replaces grouped the same fields under headings ("Who made it", "Production"),
// which reads as a form rather than a record and is not what was signed off. The grid is the
// point — every fact is one glance away, and an absence sits exactly where a value would.
//
// LIVE DATE leads because it is the field the whole calendar hinges on and the one with no owner:
// 204 of 442 assets lack it, 66 of those already published.
//
// ── WHERE THE VALUES COME FROM ────────────────────────────────────────────────────────────────
//
// Two are lifted out of `Notes / Brief` rather than the fields designed for them, because that is
// where the team actually puts them: `Instagram Published Link` is filled on 0.01% of rows while
// the URL is pasted into the brief on 14%, and the Jira ticket is only ever in the brief. A link
// nobody can see helps nobody.
//
// `owner` is `Created By` (100% populated) and is labelled OWNER, not EDITOR — it says who put the
// post into the system, not who cut it. Conflating them would put the wrong name next to work.

export const dynamic = 'force-dynamic';

/**
 * One cell of the grid.
 *
 * A cell ALWAYS renders, so the grid keeps its shape and a gap is visible as a gap. `kind` picks
 * one of the nine canonical tier-1 strings; `fine` marks a blank that is genuinely fine and must
 * not look like something to fix.
 */
function Cell({
  label,
  value,
  href,
  kind = 'notSet',
  owner,
  fine,
  note,
}: {
  label: string;
  value: string | null;
  href?: string | null;
  kind?: Tier1Key;
  owner?: string | null;
  fine?: boolean;
  note?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{label}</div>
      <div className="mt-1">
        {value !== null ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[13px] font-medium text-brand hover:underline"
            >
              {value}
            </a>
          ) : (
            <span className="text-[13px] leading-snug text-pretty">{value}</span>
          )
        ) : fine ? (
          <EmptyFine />
        ) : (
          <EmptyOwned kind={kind} owner={owner} />
        )}
      </div>
      {note ? <div className="mt-1 text-2xs leading-snug text-text-subtle">{note}</div> : null}
    </div>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  return (
    <div>
      <div className="font-display text-[22px] font-bold leading-none tabular-nums">
        {value.toLocaleString('en-US')}
      </div>
      <div className="mt-0.5 text-2xs text-text-subtle">{label}</div>
    </div>
  );
}

/**
 * How it did AGAINST WHAT — the thing the page was missing.
 *
 * Three numbers with no denominator are decoration: nobody in the meeting holds the distribution
 * of 195 Instagram posts in their head, so 1.36M views read the same as 12,000. Every line here
 * is a rank and a median over posts Perch actually captured, never a model's sentence about them,
 * and it names the platform and the count so a reader can check it.
 */
function Compare({ c }: { c: AssetComparison }) {
  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
        How it compares
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {c.lines.map((l) => (
          <li key={l.metric} className="text-[13px] leading-snug">
            <span className="font-semibold tabular-nums">{l.value}</span>{' '}
            <span className="text-text-muted">{l.metric}</span>
            {' — '}
            <span className={cn('font-medium', l.rank <= 3 ? 'text-success-content' : undefined)}>
              {l.rank === 1 ? 'the highest' : `${ordinal(l.rank)} highest`} of {l.of}
            </span>
            <span className="text-text-muted">
              {' '}
              {c.platform} post{l.of === 1 ? '' : 's'} captured. Median {l.median}
              {l.multiple ? ` — this did ${l.multiple.toFixed(1)}×` : ''}.
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 max-w-prose text-2xs leading-relaxed text-text-subtle">
        {c.posts} {c.platform} posts{c.since ? `, captured since ${c.since}` : ''}. Compared within
        one platform only — Facebook reports no reach or views, so a cross-platform median would be
        an Instagram figure wearing a total&rsquo;s clothes.
        {c.perPost ? ' Ranked per post, since this record matched several.' : ''}
      </p>
    </div>
  );
}

/** 1st, 2nd, 3rd, 4th… — a rank reads as a rank, not as a bare integer. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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
  const qs = `brand=${sp.brand ?? 'main'}${sp.week ? `&week=${sp.week}` : ''}`;
  const backHref = `/studio/comms-calendar?${qs}`;

  let asset: Awaited<ReturnType<typeof getAssetDetail>> = null;
  let error: string | null = null;
  try {
    asset = await getAssetDetail(id);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // The benchmark is a nice-to-have on a page whose job is the record: if Postgres is slow or
  // down, the fields and the figures still render and only the comparison is missing.
  let comparison: AssetComparison | null = null;
  if (asset?.results) {
    comparison = await getBenchmarks()
      .then((b) => compareAsset(asset!.results!, asset!.platforms, b))
      .catch((err) => {
        console.error('[benchmark] unavailable', err);
        return null;
      });
  }

  // The structured field first, the brief second. Both are the live post; only the provenance
  // differs, and the grid says which.
  const liveUrl = asset?.publishedUrl ?? asset?.briefPostUrl ?? null;
  const isSocial = asset?.kind === 'social';

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
              It is in neither the Videos nor the Social table — deleted since the calendar was read,
              or a link to a table this page does not render.
            </div>
          </div>
        ) : (
          <>
            {/* ── The record ─────────────────────────────────────────────── */}
            <div className="rounded-md border border-border-default bg-surface p-[22px]">
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl font-bold leading-[1.25] tracking-[-.02em] text-pretty">
                    {asset.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* VL is teal on EVERY surface. Rendering it in brand purple made the two
                        brand pills byte-identical, which is the fault `3a` found. */}
                    <Badge tone={isSocial ? 'brand' : 'vishen'}>
                      {asset.brandLabel ?? (isSocial ? 'Mindvalley' : 'Vishen Lakhiani Media')}
                    </Badge>
                    {asset.status ? (
                      <Badge tone={asset.published ? 'success' : 'neutral'}>{asset.status}</Badge>
                    ) : null}
                    {liveUrl ? (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-2xs font-semibold text-brand hover:underline"
                      >
                        See it live ↗
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* LIVE DATE, top-right, as the prototype has it. */}
                <div className="flex-none text-right">
                  <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                    Live date
                  </div>
                  {asset.liveDate ? (
                    <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-.02em]">
                      {new Date(`${asset.liveDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-.02em] text-staged-content">
                        Not dated
                      </div>
                      <div className="mt-1 max-w-[220px] text-2xs leading-snug text-text-muted">
                        No calendar can place this until a Live Date is set.
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-[22px] grid gap-5 border-t border-border-default pt-[18px] sm:grid-cols-2 lg:grid-cols-3">
                <Cell label="Message of the week" value={asset.messageName} kind="noMessage" />
                <Cell label="Goal" value={asset.goal} kind="noGoal" />
                <Cell
                  label="Owner"
                  value={asset.owner}
                  owner={isSocial ? 'nobody recorded' : 'Videos carries no owner field'}
                  note={asset.owner ? 'Who put it into the system, not who edited it.' : undefined}
                />

                <Cell label="Format" value={asset.format ?? asset.medium} fine />
                <Cell label="Purpose" value={asset.purpose} fine />
                <Cell label="Team" value={asset.teamAgency ?? asset.source} fine />

                <Cell label="Channels" value={asset.channel} fine />
                <Cell
                  label="Published link"
                  value={liveUrl ? 'Open the post' : null}
                  href={liveUrl}
                  owner="no link recorded · Glen"
                  fine={!asset.published}
                  note={liveUrl && !asset.publishedUrl ? 'Lifted out of Notes / Brief.' : undefined}
                />
                <Cell
                  label="Creative ticket"
                  value={asset.ticketId ?? (asset.briefTicketUrl ? 'Open the ticket' : null)}
                  href={asset.ticketId ? null : asset.briefTicketUrl}
                  owner="not linked · Glen"
                  fine={!isSocial}
                  note={
                    asset.ticketStatus ??
                    (asset.briefTicketUrl && !asset.ticketId ? 'Lifted out of Notes / Brief.' : undefined)
                  }
                />

                {asset.editor ? <Cell label="Editor" value={asset.editor} fine /> : null}
                {asset.kind === 'video' ? (
                  // Empty on EVERY published asset in the base. It says "not filled", never `0`.
                  <Cell label="24-hour read" value={asset.read24h} kind="notFilled" />
                ) : null}
              </div>

              {/* ── How it did ─────────────────────────────────────────────── */}
              <div className="mt-[18px] border-t border-border-default pt-[18px]">
                <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                  How it did
                </div>
                {asset.results &&
                (asset.results.views || asset.results.reach || asset.results.engagements) ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-8">
                      {/* Views first — it is the largest of the three and the one social optimises
                          for. Perch returns it inside `raw`, so it is real, not derived. */}
                      <Stat value={asset.results.views} label="views" />
                      <Stat value={asset.results.reach} label="reach" />
                      <Stat value={asset.results.engagements} label="engagements" />
                    </div>
                    <p className="mt-2 max-w-prose text-2xs leading-relaxed text-text-subtle">
                      Hootsuite Perch, matched to this post by its published caption. Figures move
                      as attribution lands, so this is a read, not a final number.
                      {asset.results.multiAccount
                        ? ` Several accounts published this copy — these are the totals across ${asset.results.posts} posts, not one.`
                        : ''}
                    </p>

                    {comparison ? <Compare c={comparison} /> : null}
                  </>
                ) : (
                  <div className="mt-2">
                    <EmptyOwned kind="notSet" owner="no published post matched this record" />
                    <p className="mt-1 max-w-prose text-2xs leading-relaxed text-text-subtle">
                      Results are matched from Hootsuite by caption — 63 of 110 posts inside Perch&rsquo;s
                      window match. The rest usually carry a briefing note in the caption field rather
                      than the copy that went out.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Same message ───────────────────────────────────────────── */}
            <section>
              <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Same message
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
                  <EmptyFine>This is the only asset on this message.</EmptyFine>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border-default bg-surface">
                  {asset.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/studio/comms-calendar/asset/${s.id}?${qs}`}
                      className="flex items-center gap-3 border-b border-border-default px-4 py-2.5 last:border-b-0 hover:bg-bg-subtle"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'h-1.5 w-1.5 flex-none rounded-full',
                          s.published ? 'bg-success' : 'bg-border-default',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{s.title}</span>
                      <span className="flex-none text-2xs text-text-subtle">
                        {s.liveDate
                          ? new Date(`${s.liveDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'UTC',
                            })
                          : 'not dated'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="text-2xs text-text-subtle">Read-only. Every field here is edited in Airtable.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
