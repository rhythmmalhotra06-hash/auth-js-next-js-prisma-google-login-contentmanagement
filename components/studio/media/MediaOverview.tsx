'use client';

// Overview tab — a calm summary cockpit, not a dump. "Needs you" shows the top few sign-offs
// in a restrained card (single gold accent); "In motion" is a per-agency scoreboard (counts,
// not item lists — the items live in Board/Calendar); "Live" is a small proof grid.

import { useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import type { VishenVideo } from '@/lib/media/vishen-videos';
import type { ShootSignOffItem } from '@/lib/studio/data';
import { approveShoot, declineShoot } from '@/app/studio/actions';
import { shortDate } from '@/lib/studio/format';
import {
  AGENCY_META, producerBucket, needsVishen,
  STAGE_LABEL, STAGE_TONE, AgencyChip, Stars,
} from './shared';

const NEEDS_PREVIEW = 5;

export function MediaOverview({ rows, shoots, clipCount, onOpen, onApprove, onSendBack, onAgencyClick, onGoToClips }: {
  rows: VishenVideo[];
  shoots: ShootSignOffItem[];
  clipCount: number;
  onOpen: (v: VishenVideo) => void;
  onApprove: (v: VishenVideo) => void;
  onSendBack: (v: VishenVideo) => void;
  onAgencyClick: (agency: string) => void;
  onGoToClips: () => void;
}) {
  const since30 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }, []);
  const [showAllNeeds, setShowAllNeeds] = useState(false);

  // Soonest live date first; undated fall to the end.
  const waiting = useMemo(
    () => rows.filter(needsVishen).sort((a, b) => (a.liveDate ?? '9999').localeCompare(b.liveDate ?? '9999')),
    [rows],
  );
  const inMotionCount = useMemo(() => rows.filter((v) => !needsVishen(v) && v.stage !== 'published').length, [rows]);
  const live = useMemo(
    () => rows.filter((v) => v.stage === 'published' && v.publishedLink)
      .sort((a, b) => (b.liveDate ?? '').localeCompare(a.liveDate ?? '')).slice(0, 6),
    [rows],
  );

  const counts = useMemo(() => ({
    editing: rows.filter((v) => v.stage === 'editing').length,
    published30: rows.filter((v) => v.stage === 'published' && (v.liveDate ?? '') >= since30).length,
  }), [rows, since30]);
  const avgRating = useMemo(() => {
    const r = rows.filter((v) => (v.rating ?? 0) > 0);
    return r.length ? (r.reduce((s, v) => s + (v.rating ?? 0), 0) / r.length).toFixed(1) : '—';
  }, [rows]);

  // Per-agency scoreboard over the whole set — counts, not item lists.
  const scoreboard = useMemo(() => {
    const map = new Map<string, VishenVideo[]>();
    for (const v of rows) { const b = producerBucket(v.source); (map.get(b) ?? map.set(b, []).get(b)!).push(v); }
    return [...map.entries()].map(([name, list]) => {
      const rated = list.filter((r) => (r.rating ?? 0) > 0);
      return {
        name,
        inFlight: list.filter((r) => r.stage !== 'published').length,
        editing: list.filter((r) => r.stage === 'editing').length,
        live30: list.filter((r) => r.stage === 'published' && (r.liveDate ?? '') >= since30).length,
        avg: rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : 0,
      };
    }).sort((a, b) => (b.inFlight + b.live30) - (a.inFlight + a.live30));
  }, [rows, since30]);

  const shownNeeds = showAllNeeds ? waiting : waiting.slice(0, NEEDS_PREVIEW);

  return (
    <div className="space-y-8">
      <KpiGrid>
        <Kpi label="Awaiting you" value={waiting.length} tone={waiting.length ? 'attention' : undefined} sub="on your desk" i={0} />
        <Kpi label="In motion" value={inMotionCount} sub={`${counts.editing} in editing`} i={1} />
        <Kpi label="Published · 30d" value={counts.published30} sub="live across channels" i={2} />
        <Kpi label="Your avg rating" value={<>{avgRating}<span className="text-lg text-gold"> ★</span></>} i={3} />
      </KpiGrid>

      {/* Needs you — one calm card, gold accent; unifies video + shoot + clip sign-offs */}
      <section>
        <SecHead eyebrow="● Needs you" eyebrowTone="gold" title="Approve, rate, or send back"
          hint={`${waiting.length + shoots.length} to sign off${clipCount ? ` · ${clipCount} clips` : ''}`} />
        {waiting.length === 0 && shoots.length === 0 && clipCount === 0 ? (
          <Placeholder>All caught up — nothing waiting on you. 🎉</Placeholder>
        ) : (
          <div className="overflow-hidden rounded-md border border-l-[3px] border-border-default border-l-gold bg-surface shadow-[var(--mv-shadow-light)]">
            {/* Videos */}
            {waiting.length > 0 && (
              <>
                <GroupLabel>🎬 Videos · {waiting.length}</GroupLabel>
                {shownNeeds.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 border-b border-border-muted px-4 py-3 last:border-0 hover:bg-bg-subtle">
                    <div className="min-w-0 flex-1">
                      <button onClick={() => onOpen(v)} className="block truncate text-left text-[13px] font-semibold text-text hover:underline">{v.name}</button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <AgencyChip source={v.source} />
                        <Badge tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Badge>
                        {v.liveDate && <span className="text-2xs text-text-subtle">📅 {v.liveDate}</span>}
                      </div>
                    </div>
                    <div className="flex flex-none gap-2">
                      <button onClick={() => onSendBack(v)}
                        className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-subtle">Send back</button>
                      <button onClick={() => onApprove(v)}
                        className="rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
                    </div>
                  </div>
                ))}
                {waiting.length > NEEDS_PREVIEW && (
                  <button onClick={() => setShowAllNeeds((s) => !s)}
                    className="w-full border-b border-border-muted px-4 py-2 text-xs font-semibold text-brand-content hover:bg-bg-subtle">
                    {showAllNeeds ? 'Show fewer' : `Show all ${waiting.length} →`}
                  </button>
                )}
              </>
            )}

            {/* Shoots */}
            {shoots.length > 0 && (
              <>
                <GroupLabel>🎥 Shoots · {shoots.length}</GroupLabel>
                <NeedsYouShoots items={shoots} />
              </>
            )}

            {/* Clips */}
            {clipCount > 0 && (
              <>
                <GroupLabel>✦ Clip ideas · {clipCount}</GroupLabel>
                <button onClick={onGoToClips}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-text hover:bg-bg-subtle">
                  <span className="min-w-0 flex-1">Clip ideas from your media, ready for a look</span>
                  <span className="flex-none text-xs font-semibold text-brand-content">Review in Clips →</span>
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* In motion — agency scoreboard (counts, not lists) */}
      <section>
        <SecHead eyebrow="◆ In motion" title="What each agency is making" hint="click an agency to see its work" />
        {scoreboard.length === 0 ? (
          <Placeholder>Nothing in flight right now.</Placeholder>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scoreboard.map((a) => (
              <button key={a.name} onClick={() => onAgencyClick(a.name)}
                className="rounded-md border border-border-default bg-surface p-4 text-left shadow-[var(--mv-shadow-light)] transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-[var(--mv-shadow-medium)]">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: AGENCY_META[a.name].token }} />
                  <span className="truncate text-[13.5px] font-bold text-text">{a.name}</span>
                </div>
                <div className="flex gap-5">
                  <Stat k="In flight" v={<span className={cn(a.inFlight >= 10 && 'text-warning-content')}>{a.inFlight}</span>} />
                  <Stat k="Editing" v={a.editing} />
                  <Stat k="Live · 30d" v={a.live30} />
                  <Stat k="Avg ★" v={a.avg ? <span className="tracking-wide text-gold">{a.avg.toFixed(1)}</span> : <span className="text-text-subtle">—</span>} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Live */}
      <section>
        <SecHead eyebrow="◆ Live & performing" eyebrowTone="green" title="Recently published" />
        {live.length === 0 ? (
          <Placeholder>Nothing published yet.</Placeholder>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((v) => (
              <button key={v.id} onClick={() => onOpen(v)}
                className="overflow-hidden rounded-md border border-border-default bg-surface text-left shadow-[var(--mv-shadow-light)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--mv-shadow-medium)]">
                <div className="relative flex h-[74px] items-end p-3"
                  style={{ background: `linear-gradient(135deg, ${AGENCY_META[producerBucket(v.source)].token}, var(--brand))` }}>
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-g700">{v.channel}</span>
                </div>
                <div className="p-3">
                  <b className="block truncate text-[13px] font-semibold text-text">{v.name}</b>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Stars n={v.rating} />
                    <AgencyChip source={v.source} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-text-subtle">{k}</div>
      <div className="font-display text-lg font-bold leading-none tabular-nums text-text">{v}</div>
    </div>
  );
}

function SecHead({ eyebrow, eyebrowTone, title, hint }: {
  eyebrow: string; eyebrowTone?: 'gold' | 'green'; title: string; hint?: string;
}) {
  return (
    <div className="mb-3">
      <span className={cn('text-2xs font-bold uppercase tracking-wider',
        eyebrowTone === 'gold' ? 'text-gold-content' : eyebrowTone === 'green' ? 'text-success-content' : 'text-brand')}>{eyebrow}</span>
      <div className="flex items-baseline gap-3">
        <h3 className="font-display text-base font-bold text-text">{title}</h3>
        {hint && <span className="ml-auto text-xs text-text-subtle">{hint}</span>}
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border-default bg-surface p-5 text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">{children}</div>;
}

/** Sub-group divider inside the unified "Needs you" card. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border-muted bg-bg-subtle px-4 py-1.5 text-2xs font-bold uppercase tracking-wide text-text-subtle">
      {children}
    </div>
  );
}

/** Shoot sign-offs inside "Needs you" — calm rows with Approve / Send back via the existing
 *  studio actions; optimistic hide. Full note-decline lives on /studio/shoots/[id]. */
function NeedsYouShoots({ items }: { items: ShootSignOffItem[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const visible = items.filter((s) => !hidden.has(s.id));

  if (visible.length === 0) return null;
  return (
    <>
      {visible.map((s) => (
        <div key={s.id} className={cn('flex flex-wrap items-center gap-3 border-b border-border-muted px-4 py-3 last:border-0 hover:bg-bg-subtle', pending && 'opacity-70')}>
          <div className="min-w-0 flex-1">
            <a href={`/studio/shoots/${s.id}`} className="block truncate text-[13px] font-semibold text-text hover:underline">{s.title}</a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-text-subtle">
              {s.format && <span>{s.format}</span>}
              {s.filmingDate && <span>📅 {shortDate(s.filmingDate)}</span>}
              {s.filmingLocation && <span>📍 {s.filmingLocation}</span>}
            </div>
          </div>
          <div className="flex flex-none gap-2">
            <button disabled={pending} onClick={() => start(async () => { const r = await declineShoot(s.id); if (r.ok) hide(s.id); })}
              className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">Send back</button>
            <button disabled={pending} onClick={() => start(async () => { const r = await approveShoot(s.id); if (r.ok) hide(s.id); })}
              className="rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright disabled:opacity-50">Approve</button>
          </div>
        </div>
      ))}
    </>
  );
}
