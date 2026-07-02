'use client';

import { useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { approveVideo, sendBackVideo, rateVideo, saveViews24h } from '@/app/studio/media/actions';
import type { VishenVideo, VideoStage, VideoChannel } from '@/lib/media/vishen-videos';

// ── Display maps ──────────────────────────────────────────────────────────────
const AGENCIES = ['Simplex Media', 'Simplex (by Vishen)', 'Talking Heads', 'Two Comma PR'];
function producerBucket(source: string | null): string {
  return source && AGENCIES.includes(source) ? source : 'Internal';
}
const PRODUCER_META: Record<string, { short: string; kind: string }> = {
  'Simplex Media': { short: 'SM', kind: 'Agency · YouTube' },
  'Simplex (by Vishen)': { short: 'SV', kind: 'Agency · YouTube' },
  'Talking Heads': { short: 'TH', kind: 'Agency · YouTube' },
  'Two Comma PR': { short: '2C', kind: 'Agency · LinkedIn' },
  'Internal': { short: 'MV', kind: 'Vishen · Will · Ramya · Academy' },
};
const STAGE_LABEL: Record<VideoStage, string> = {
  production: 'In production', filmed: 'Filmed', editing: 'In editing', published: 'Published', other: 'Other',
};
const STAGE_TONE: Record<VideoStage, Tone> = {
  production: 'info', filmed: 'brand', editing: 'warning', published: 'success', other: 'neutral',
};
const APPROVAL_TONE: Record<string, Tone> = {
  'To Review': 'warning', 'Approved': 'success', 'To Refine': 'brand', 'Rejected': 'danger', 'Parked for later': 'neutral',
};
const CHANNELS: VideoChannel[] = ['YouTube', 'LinkedIn', 'Instagram', 'Email', 'Web'];

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-xs text-text-subtle">—</span>;
  return (
    <span className="whitespace-nowrap text-xs tracking-wider text-gold" aria-label={`${n} of 5`}>
      {'★'.repeat(n)}<span className="text-border-strong">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

type TimeWindow = 'all' | 'year' | '30';

export function VishenMediaBoard({ videos }: { videos: VishenVideo[] }) {
  const [rows, setRows] = useState<VishenVideo[]>(videos);
  const [producer, setProducer] = useState<string>('all');
  const [channel, setChannel] = useState<string>('all');
  const [time, setTime] = useState<TimeWindow>('all');
  const [stage, setStage] = useState<VideoStage | 'all' | 'waiting'>('all');
  const [selected, setSelected] = useState<VishenVideo | null>(null);
  const [pending, start] = useTransition();

  const since30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  }, []);

  const visible = useMemo(() => {
    const inTime = (v: VishenVideo): boolean => {
      if (time === 'all') return true;
      const d = v.liveDate;
      if (!d) return false;
      if (time === 'year') return d.slice(0, 4) === String(new Date().getFullYear());
      return d >= since30;
    };
    return rows.filter((v) =>
      (producer === 'all' || producerBucket(v.source) === producer) &&
      (channel === 'all' || v.channel === channel) &&
      (stage === 'all' || (stage === 'waiting' ? v.approval === 'To Review' : v.stage === stage)) &&
      inTime(v)
    );
  }, [rows, producer, channel, stage, time, since30]);

  const waiting = useMemo(() => rows.filter((v) => v.approval === 'To Review'), [rows]);
  const counts = useMemo(() => ({
    production: rows.filter((v) => v.stage === 'production').length,
    editing: rows.filter((v) => v.stage === 'editing').length,
    publishedRecent: rows.filter((v) => v.stage === 'published' && (v.liveDate ?? '') >= since30).length,
  }), [rows, since30]);
  const avgRating = useMemo(() => {
    const r = rows.filter((v) => (v.rating ?? 0) > 0);
    return r.length ? (r.reduce((s, v) => s + (v.rating ?? 0), 0) / r.length).toFixed(1) : '—';
  }, [rows]);

  const scoreboard = useMemo(() => {
    const map = new Map<string, VishenVideo[]>();
    for (const v of rows) { const b = producerBucket(v.source); (map.get(b) ?? map.set(b, []).get(b)!).push(v); }
    return [...map.entries()].map(([name, list]) => {
      const rated = list.filter((r) => (r.rating ?? 0) > 0);
      return {
        name,
        inFlight: list.filter((r) => r.stage !== 'published').length,
        live30: list.filter((r) => r.stage === 'published' && (r.liveDate ?? '') >= since30).length,
        avg: rated.length ? Math.round(rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) : 0,
      };
    }).sort((a, b) => b.inFlight + b.live30 - (a.inFlight + a.live30));
  }, [rows, since30]);

  // Optimistic local update + server write.
  function applyApproval(id: string, approval: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setRows((rs) => rs.map((v) => (v.id === id ? { ...v, approval } : v)));
    setSelected((s) => (s && s.id === id ? { ...s, approval } : s));
    start(async () => { await action(); });
  }
  function applyRating(id: string, rating: number) {
    setRows((rs) => rs.map((v) => (v.id === id ? { ...v, rating } : v)));
    setSelected((s) => (s && s.id === id ? { ...s, rating } : s));
    start(async () => { await rateVideo(id, rating); });
  }
  function applyViews24h(id: string, views24h: string) {
    setRows((rs) => rs.map((v) => (v.id === id ? { ...v, views24h } : v)));
    setSelected((s) => (s && s.id === id ? { ...s, views24h } : s));
    start(async () => { await saveViews24h(id, views24h); });
  }

  return (
    <div className={cn('space-y-6', pending && 'opacity-95')}>
      {/* Pulse */}
      <KpiGrid>
        <Kpi label="In production" value={counts.production}
          onClick={() => setStage((s) => (s === 'production' ? 'all' : 'production'))} active={stage === 'production'} i={0} />
        <Kpi label="In editing" value={counts.editing}
          onClick={() => setStage((s) => (s === 'editing' ? 'all' : 'editing'))} active={stage === 'editing'} i={1} />
        <Kpi label="Published · 30d" value={counts.publishedRecent}
          onClick={() => setStage((s) => (s === 'published' ? 'all' : 'published'))} active={stage === 'published'} i={2} />
        <Kpi label="Waiting on you" value={waiting.length} tone={waiting.length ? 'attention' : undefined}
          onClick={() => setStage((s) => (s === 'waiting' ? 'all' : 'waiting'))} active={stage === 'waiting'} i={3} />
        <Kpi label="Your avg rating" value={<>{avgRating}<span className="text-lg text-gold"> ★</span></>} i={4} />
      </KpiGrid>

      {/* Waiting on you */}
      {waiting.length > 0 && (
        <section
          className="rounded-lg p-5 text-white shadow-[var(--mv-shadow-strong)]"
          style={{ background: 'linear-gradient(150deg, var(--brand) 0%, var(--violet) 118%)' }}
        >
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="text-base">✍️</span>
            <h3 className="font-display text-base font-bold">Waiting on your sign-off</h3>
            <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{waiting.length}</span>
          </div>
          <div className="space-y-2.5">
            {waiting.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-sm bg-surface p-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-sm bg-brand-soft text-sm text-brand-content">🎬</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] font-semibold text-text">{v.name}</b>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{producerBucket(v.source)}</Badge>
                    <Badge tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Badge>
                    <RateStars value={v.rating} onRate={(n) => applyRating(v.id, n)} />
                  </div>
                </div>
                <div className="flex flex-none gap-2">
                  <button onClick={() => applyApproval(v.id, 'To Refine', () => sendBackVideo(v.id))}
                    className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-subtle">Send back</button>
                  <button onClick={() => applyApproval(v.id, 'Approved', () => approveVideo(v.id))}
                    className="rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Producer scoreboard */}
      <section>
        <div className="mb-2.5 flex items-baseline gap-3">
          <h3 className="font-display text-base font-bold text-text">By producer</h3>
          <span className="text-xs text-text-subtle">click a card to filter · ⚑ flags where work is piling up</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {scoreboard.map((a) => {
            const meta = PRODUCER_META[a.name] ?? { short: a.name.slice(0, 2).toUpperCase(), kind: '' };
            const on = producer === a.name;
            return (
              <button key={a.name} aria-pressed={on}
                onClick={() => setProducer((p) => (p === a.name ? 'all' : a.name))}
                className={cn('rounded-md border bg-surface p-4 text-left shadow-[var(--mv-shadow-light)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--mv-shadow-medium)]',
                  on ? 'border-brand shadow-[0_0_0_1px_var(--brand)]' : 'border-border-default')}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-sm bg-brand-soft text-2xs font-bold text-brand-content">{meta.short}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-text">{a.name}</div>
                    <div className="text-2xs text-text-subtle">{meta.kind}</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <ScoreStat k="In flight" v={<span className={cn(a.inFlight >= 3 && 'text-warning-content')}>{a.inFlight}{a.inFlight >= 3 ? ' ⚑' : ''}</span>} />
                  <ScoreStat k="Live · 30d" v={a.live30} />
                  <ScoreStat k="Avg ★" v={a.avg ? <span className="text-sm tracking-wide text-gold">{'★'.repeat(a.avg)}</span> : <span className="text-text-subtle">—</span>} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips label="Producer" value={producer} onChange={setProducer}
          options={[['all', 'All producers'], ...Object.keys(PRODUCER_META).filter((k) => scoreboard.some((s) => s.name === k)).map((k) => [k, k] as [string, string])]} />
        <FilterChips label="Channel" value={channel} onChange={setChannel}
          options={[['all', 'All channels'], ...CHANNELS.map((c) => [c, c] as [string, string])]} />
        <select value={time} onChange={(e) => setTime(e.target.value as TimeWindow)}
          className="ml-auto rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs text-text">
          <option value="all">All time</option>
          <option value="year">This year</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {/* Tracker */}
      <div>
        <div className="mb-2.5 flex items-baseline gap-3">
          <h3 className="font-display text-base font-bold text-text">Every video</h3>
          <span className="ml-auto text-xs text-text-subtle">{visible.length} of {rows.length} shown</span>
        </div>
        <div className="overflow-x-auto rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-2xs uppercase tracking-wide text-text-subtle">
                {['Title', 'Rating', 'Made by', 'Status', 'Sign-off', 'Channel', 'Live link', 'Live date'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((v) => (
                <tr key={v.id} onClick={() => setSelected(v)}
                  className="cursor-pointer border-b border-border-muted last:border-0 hover:bg-bg-subtle">
                  <td className="max-w-[280px] px-4 py-3">
                    <div className="truncate font-medium text-text">{v.name}</div>
                    {v.medium && <div className="truncate text-2xs text-text-subtle">{v.medium}{v.format ? ` · ${v.format}` : ''}</div>}
                  </td>
                  <td className="px-4 py-3"><Stars n={v.rating} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{producerBucket(v.source)}</td>
                  <td className="px-4 py-3"><Badge tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Badge></td>
                  <td className="px-4 py-3">{v.approval ? <Badge tone={APPROVAL_TONE[v.approval] ?? 'neutral'}>{v.approval}</Badge> : <span className="text-xs text-text-subtle">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{v.channel}</td>
                  <td className="px-4 py-3">{v.publishedLink
                    ? <a href={v.publishedLink} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-content hover:underline">Open ↗</a>
                    : <span className="text-xs text-text-subtle">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-subtle">{v.liveDate ?? '—'}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-subtle">No videos match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-start gap-3 rounded-md bg-brand-soft px-4 py-3.5 text-xs leading-relaxed text-brand-content">
        <span className="text-sm">🔒</span>
        <span><b>Nothing changes without you.</b> Approvals and ratings you make here write straight back to your Videos base. The team advances everything else in Airtable — this is your window onto their work, not a second system to maintain.</span>
      </p>

      {/* Detail drawer */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? `${producerBucket(selected.source)} · ${selected.medium ?? ''}` : ''}
        title={selected?.name ?? 'Video'}
        footer={selected && selected.approval === 'To Review' ? (
          <div className="flex gap-2.5">
            <button onClick={() => { applyApproval(selected.id, 'To Refine', () => sendBackVideo(selected.id)); setSelected(null); }}
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg-subtle">Send back</button>
            <button onClick={() => { applyApproval(selected.id, 'Approved', () => approveVideo(selected.id)); setSelected(null); }}
              className="flex-1 rounded-sm bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
          </div>
        ) : undefined}
      >
        {selected && (
          <VideoDetail
            key={selected.id}
            v={selected}
            onRate={(n) => applyRating(selected.id, n)}
            onSaveViews={(t) => applyViews24h(selected.id, t)}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

function ScoreStat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-text-subtle">{k}</div>
      <div className="font-display text-xl font-bold leading-none tabular-nums text-text">{v}</div>
    </div>
  );
}

function FilterChips({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={cn(value === v && 'on')}>{l}</button>
      ))}
    </div>
  );
}

function RateStars({ value, onRate }: { value: number | null; onRate: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5" role="group" aria-label="Rate">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={(e) => { e.stopPropagation(); onRate(n); }}
          className={cn('text-sm leading-none', (value ?? 0) >= n ? 'text-gold' : 'text-border-strong hover:text-gold')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
      ))}
    </span>
  );
}

const STEPS: { label: string; n: number }[] = [
  { label: 'Idea', n: 1 }, { label: 'Confirmed', n: 2 }, { label: 'To shoot', n: 3 },
  { label: 'Filmed', n: 4 }, { label: 'In editing', n: 5 }, { label: 'Published', n: 6 },
];

function VideoDetail({ v, onRate, onSaveViews }: { v: VishenVideo; onRate: (n: number) => void; onSaveViews: (t: string) => void }) {
  const isPub = v.stage === 'published';
  const cur = isPub ? 6 : v.status ? parseInt(v.status, 10) : 0;
  const [views, setViews] = useState(v.views24h ?? '');
  const dirty = views.trim() !== (v.views24h ?? '').trim();
  return (
    <div className="space-y-6 text-sm">
      <div>
        <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-text-subtle">Lifecycle</div>
        <div className="mt-2 flex flex-col">
          {STEPS.map((s, i) => {
            const done = s.n < cur, current = s.n === cur;
            return (
              <div key={s.n} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < STEPS.length - 1 && <span className={cn('absolute left-2 top-5 -bottom-0.5 w-0.5', done ? 'bg-success' : 'bg-border-strong')} />}
                <span className={cn('z-[1] mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border-2',
                  done ? 'border-success bg-success' : current ? 'border-brand bg-brand shadow-[0_0_0_4px_var(--brand-soft)]' : 'border-border-strong bg-surface')} />
                <div>
                  <div className={cn('text-[13px]', current || done ? 'font-semibold text-text' : 'text-text-subtle')}>{s.label}</div>
                  {current && <div className="text-2xs text-text-subtle">current · sign-off {v.approval ?? '—'}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-text-subtle">Details</div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[13px]">
          <dt className="font-semibold text-text-subtle">Made by</dt><dd className="text-right text-text">{v.source ?? '—'}</dd>
          <dt className="font-semibold text-text-subtle">Channel</dt><dd className="text-right text-text">{v.channel}</dd>
          <dt className="font-semibold text-text-subtle">Promotes</dt><dd className="text-right text-text">{v.product ?? '—'}</dd>
          <dt className="font-semibold text-text-subtle">Live date</dt><dd className="text-right text-text">{v.liveDate ?? '—'}</dd>
          <dt className="font-semibold text-text-subtle">Live link</dt>
          <dd className="text-right">{v.publishedLink ? <a href={v.publishedLink} target="_blank" rel="noopener" className="font-semibold text-brand-content hover:underline">Open ↗</a> : <span className="text-text-subtle">not yet posted</span>}</dd>
          <dt className="font-semibold text-text-subtle">Your rating</dt><dd className="text-right"><RateStars value={v.rating} onRate={onRate} /></dd>
        </dl>
      </div>

      {isPub && (
        <div className="rounded-md border p-4"
          style={{ borderColor: 'color-mix(in srgb, var(--gold) 34%, transparent)', background: 'linear-gradient(180deg, var(--gold-soft), var(--surface) 82%)' }}>
          <div className="text-2xs font-bold uppercase tracking-wide text-warning-content">◆ 24h performance</div>
          <p className="mt-1.5 text-xs text-text-muted">Logged by the team at 24h (views + engagement, any format) — Postiz / Hootsuite auto-fill is Phase 2.</p>
          <textarea
            value={views}
            onChange={(e) => setViews(e.target.value)}
            rows={3}
            placeholder="e.g. IG 71k views · 5.1% eng · LinkedIn 12k · 320 reactions"
            className="mt-2.5 w-full resize-y rounded-sm border border-border-strong bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-subtle focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={!dirty} onClick={() => onSaveViews(views.trim())}
              className="rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright disabled:opacity-40">Save 24h data</button>
            {!dirty && v.views24h && <span className="text-2xs text-text-subtle">saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
