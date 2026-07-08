'use client';

// Overview tab — the 3-section status hub: what needs Vishen, what each agency has in
// flight, and what's recently live. The KPIs summarize; the sections below segment by status.

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import type { VishenVideo } from '@/lib/media/vishen-videos';
import {
  AGENCY_META, agencyColor, producerBucket, needsVishen,
  STAGE_LABEL, STAGE_TONE, AgencyChip, Stars, RateStars,
} from './shared';

export function MediaOverview({ rows, onOpen, onApprove, onSendBack, onRate }: {
  rows: VishenVideo[];
  onOpen: (v: VishenVideo) => void;
  onApprove: (v: VishenVideo) => void;
  onSendBack: (v: VishenVideo) => void;
  onRate: (v: VishenVideo, n: number) => void;
}) {
  const since30 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }, []);

  const waiting = useMemo(() => rows.filter(needsVishen), [rows]);
  const inMotion = useMemo(() => rows.filter((v) => !needsVishen(v) && v.stage !== 'published'), [rows]);
  const live = useMemo(
    () => rows.filter((v) => v.stage === 'published' && v.publishedLink)
      .sort((a, b) => (b.liveDate ?? '').localeCompare(a.liveDate ?? '')).slice(0, 6),
    [rows],
  );

  const counts = useMemo(() => ({
    production: rows.filter((v) => v.stage === 'production' || v.stage === 'filmed').length,
    editing: rows.filter((v) => v.stage === 'editing').length,
    published30: rows.filter((v) => v.stage === 'published' && (v.liveDate ?? '') >= since30).length,
  }), [rows, since30]);
  const avgRating = useMemo(() => {
    const r = rows.filter((v) => (v.rating ?? 0) > 0);
    return r.length ? (r.reduce((s, v) => s + (v.rating ?? 0), 0) / r.length).toFixed(1) : '—';
  }, [rows]);

  // Agency lanes over in-flight work, most-loaded first.
  const lanes = useMemo(() => {
    const map = new Map<string, VishenVideo[]>();
    for (const v of inMotion) { const b = producerBucket(v.source); (map.get(b) ?? map.set(b, []).get(b)!).push(v); }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [inMotion]);

  return (
    <div className="space-y-8">
      <KpiGrid>
        <Kpi label="Awaiting you" value={waiting.length} tone={waiting.length ? 'attention' : undefined} sub="on your desk" i={0} />
        <Kpi label="In motion" value={inMotion.length} sub={`${counts.editing} in editing`} i={1} />
        <Kpi label="Published · 30d" value={counts.published30} sub="live across channels" i={2} />
        <Kpi label="Your avg rating" value={<>{avgRating}<span className="text-lg text-gold"> ★</span></>} i={3} />
      </KpiGrid>

      {/* Needs you */}
      <section>
        <SecHead eyebrow="● Needs you" eyebrowTone="gold" title="Approve, rate, or send back" hint={`${waiting.length} waiting`} />
        {waiting.length === 0 ? (
          <div className="rounded-md border border-border-default bg-surface p-5 text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">
            All caught up — nothing waiting on you. 🎉
          </div>
        ) : (
          <section className="rounded-lg p-5 text-white shadow-[var(--mv-shadow-strong)]"
            style={{ background: 'linear-gradient(150deg, var(--brand) 0%, var(--st-violet, #7c3aed) 118%)' }}>
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="text-base">✍️</span>
              <h3 className="font-display text-base font-bold">These are on your desk</h3>
              <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{waiting.length}</span>
            </div>
            <div className="space-y-2.5">
              {waiting.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-sm bg-surface p-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-sm bg-brand-soft text-sm text-brand-content">🎬</span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpen(v)} className="block truncate text-left text-[13px] font-semibold text-text hover:underline">{v.name}</button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <AgencyChip source={v.source} />
                      <Badge tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Badge>
                      {v.liveDate && <span className="text-2xs text-text-subtle">📅 {v.liveDate}</span>}
                      <RateStars value={v.rating} onRate={(n) => onRate(v, n)} />
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
            </div>
          </section>
        )}
      </section>

      {/* In motion */}
      <section>
        <SecHead eyebrow="◆ In motion" title="What each agency is making" hint="not live yet" />
        {lanes.length === 0 ? (
          <div className="rounded-md border border-border-default bg-surface p-5 text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">Nothing in flight right now.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {lanes.map(([name, items]) => (
              <div key={name} className="overflow-hidden rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
                <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: AGENCY_META[name].token }} />
                  <span className="text-[13.5px] font-bold text-text">{name}</span>
                  <span className="ml-auto text-xs text-text-subtle tabular-nums">{items.length} in flight</span>
                </div>
                {items.map((v) => (
                  <button key={v.id} onClick={() => onOpen(v)}
                    className="flex w-full items-center gap-2.5 border-b border-border-muted px-4 py-2.5 text-left last:border-0 hover:bg-bg-subtle">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{v.name}</span>
                    <Badge tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Badge>
                    {v.liveDate && <span className="whitespace-nowrap text-2xs text-text-subtle">{v.liveDate}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live */}
      <section>
        <SecHead eyebrow="◆ Live & performing" eyebrowTone="green" title="Recently published" />
        {live.length === 0 ? (
          <div className="rounded-md border border-border-default bg-surface p-5 text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">Nothing published yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((v) => (
              <button key={v.id} onClick={() => onOpen(v)}
                className="overflow-hidden rounded-md border border-border-default bg-surface text-left shadow-[var(--mv-shadow-light)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--mv-shadow-medium)]">
                <div className="relative flex h-[74px] items-end p-3"
                  style={{ background: `linear-gradient(135deg, ${agencyColor(v.source)}, var(--brand))` }}>
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
