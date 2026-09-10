// The first five minutes of the meeting — artboard-adjacent, modelled on Glen's weekly brief.
//
// His report opens by telling you what happened before it shows you a single table: what landed,
// what was dark, what the standout was. That ordering is the whole reason it reads as a briefing
// rather than a dashboard, and it is what "make social reporting smarter" is asking for.
//
// Every line here is COMPUTED. The judgement Glen adds — "protect the format and look at scaling
// it", "start A/B testing this week" — lives in the learnings below, staged until a human commits
// it, because that was his own condition: a recommendation that is not true might derail
// everything. Facts here, opinions there, and the difference is visible.

import Link from 'next/link';
import { InsightCard } from '@/components/ui/InsightCard';
import { EmptyFine } from '@/components/ui/Empty';
import type { Briefing as BriefingData } from '@/lib/mow/briefing';

// InsightCard carries two tones. A neutral fact (coverage, provenance) is not a warning — it maps
// to the calm one rather than inventing a third state that the component cannot render.
const TONE = { good: 'good', warn: 'warn', neutral: 'good' } as const;

export function Briefing({ briefing, weekHref }: { briefing: BriefingData; weekHref: string }) {
  const { facts, formats, formatCoverage, platforms, standout } = briefing;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* ── What happened, in sentences ─────────────────────────────────── */}
      {facts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {facts.map((f, i) => (
            <InsightCard key={f.headline} tone={TONE[f.tone]} title={f.headline} detail={f.detail} i={i} />
          ))}
        </div>
      ) : (
        <EmptyFine>Nothing has happened this week yet.</EmptyFine>
      )}

      {standout ? (
        <Link
          href={`/studio/comms-calendar/asset/${standout.id}?brand=main&week=${weekHref}`}
          className="text-[12.5px] font-medium text-brand hover:underline"
        >
          Open the week&rsquo;s strongest post →
        </Link>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {/* ── Per platform. Never summed across them. ────────────────────── */}
        <div className="rounded-md border border-border-default bg-surface p-[18px]">
          <h3 className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
            By platform
          </h3>
          {platforms.length ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {platforms.map((p) => (
                <div key={p.platform} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="min-w-[84px] text-[13px] font-semibold">{p.platform}</span>
                  <span className="text-2xs text-text-muted">{p.posts} posts</span>
                  {/* Null is "not measured", which is not the same claim as zero. */}
                  {p.reach === null && p.engagements === null ? (
                    <EmptyFine>no matched results</EmptyFine>
                  ) : (
                    <span className="text-xs tabular-nums">
                      {p.reach !== null ? `${p.reach.toLocaleString('en-US')} reach` : null}
                      {p.reach !== null && p.engagements !== null ? ' · ' : null}
                      {p.engagements !== null ? `${p.engagements.toLocaleString('en-US')} engagements` : null}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2"><EmptyFine>No posts linked this week.</EmptyFine></div>
          )}
        </div>

        {/* ── Format mix, with its coverage stated ───────────────────────── */}
        <div className="rounded-md border border-border-default bg-surface p-[18px]">
          <h3 className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
            Formats that went out
          </h3>
          {formats.length ? (
            <>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                {formats.map((f) => (
                  <div key={f.name}>
                    <div className="font-display text-[17px] font-bold leading-none tabular-nums">{f.count}</div>
                    <div className="mt-0.5 text-2xs text-text-muted">{f.name}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-2xs leading-relaxed text-text-subtle">
                {/*
                  Say the coverage plainly. Only titles following the "Programme:: Topic - Format"
                  convention declare a format — 29% of them base-wide — so this is a mix of what
                  named itself, not a census of the week. Presenting it as the latter would be a
                  claim built on a third of the data.
                */}
                From {formatCoverage.named} of {formatCoverage.total} posts whose title names a
                format. The rest use a different naming convention, so their format is unknown
                rather than absent.
              </p>
            </>
          ) : (
            <div className="mt-2">
              <EmptyFine>No post titles this week follow the naming convention.</EmptyFine>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
