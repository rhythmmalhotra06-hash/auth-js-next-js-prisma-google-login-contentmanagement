'use client';

// Shared display vocabulary for the media hub tabs (Overview / Calendar / Clips / Board).
// Agency is the primary grouping axis (the reliable "who made it" tag); channel is derived
// and secondary. Colors flow through the --ag-* tokens in globals.css (light + dark).

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { type Tone } from '@/components/ui/Badge';
import type { VishenVideo, VideoStage } from '@/lib/media/vishen-videos';

export const AGENCIES = ['Simplex Media', 'Simplex (by Vishen)', 'Talking Heads', 'Two Comma PR'] as const;

/** Named external agencies keep their identity; everyone else rolls up to "Internal". */
export function producerBucket(source: string | null): string {
  return source && (AGENCIES as readonly string[]).includes(source) ? source : 'Internal';
}

export const AGENCY_META: Record<string, { short: string; kind: string; token: string }> = {
  'Simplex Media': { short: 'SM', kind: 'Agency · YouTube', token: 'var(--ag-simplex)' },
  'Simplex (by Vishen)': { short: 'SV', kind: 'Agency · YouTube', token: 'var(--ag-svishen)' },
  'Talking Heads': { short: 'TH', kind: 'Agency · YouTube', token: 'var(--ag-talking)' },
  'Two Comma PR': { short: '2C', kind: 'Agency · LinkedIn', token: 'var(--ag-twocomma)' },
  'Internal': { short: 'MV', kind: 'Vishen · Will · Ramya · Academy', token: 'var(--ag-internal)' },
};

/** CSS color token for an agency (falls back to Internal). */
export function agencyColor(source: string | null): string {
  return (AGENCY_META[producerBucket(source)] ?? AGENCY_META.Internal).token;
}

export const STAGE_LABEL: Record<VideoStage, string> = {
  production: 'In production', filmed: 'Filmed', editing: 'In editing', published: 'Published', other: 'Other',
};
// Calm by design: gold ('warning') is reserved for the single "needs you" accent, so
// no stage badge uses it. Stages read as neutral pipeline states, not alarms.
export const STAGE_TONE: Record<VideoStage, Tone> = {
  production: 'info', filmed: 'brand', editing: 'neutral', published: 'success', other: 'neutral',
};
export const APPROVAL_TONE: Record<string, Tone> = {
  'To Review': 'warning', 'Approved': 'success', 'To Refine': 'brand', 'Rejected': 'danger', 'Parked for later': 'neutral',
};

/** A video is on Vishen's desk when his sign-off axis reads "To Review". */
export function needsVishen(v: VishenVideo): boolean {
  return v.approval === 'To Review';
}

/** A small agency identity chip — colored dot + short name. */
export function AgencyChip({ source }: { source: string | null }) {
  const name = producerBucket(source);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-text-muted">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: agencyColor(source) }} />
      {name}
    </span>
  );
}

export function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-xs text-text-subtle">—</span>;
  return (
    <span className="whitespace-nowrap text-xs tracking-wider text-gold" aria-label={`${n} of 5`}>
      {'★'.repeat(n)}<span className="text-border-strong">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export function RateStars({ value, onRate }: { value: number | null; onRate: (n: number) => void }) {
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

/** The lifecycle timeline + details + 24h-performance panel shown inside the drawer. */
export function VideoDetail({ v, onRate, onSaveViews }: {
  v: VishenVideo; onRate: (n: number) => void; onSaveViews: (t: string) => void;
}) {
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
