'use client';

// Month-grid calendar for Vishen's media. Records land on their Live Date; undated
// in-flight work sits in the "No date yet" rail so nothing hides. Chips are colored by
// AGENCY (the reliable "who made it" tag); a gold ⚑ marks anything awaiting his sign-off.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import type { VishenVideo, VideoChannel } from '@/lib/media/vishen-videos';
import { AGENCIES, AGENCY_META, agencyColor, producerBucket, needsVishen } from './shared';

type StatusBucket = 'production' | 'editing' | 'review' | 'published' | 'other';
const CHANNELS: VideoChannel[] = ['YouTube', 'LinkedIn', 'Instagram', 'Email', 'Web'];

/** Coarse bucket used by the status filter — sign-off wins over pipeline stage. */
function bucketOf(v: VishenVideo): StatusBucket {
  if (needsVishen(v)) return 'review';
  if (v.stage === 'production' || v.stage === 'filmed') return 'production';
  if (v.stage === 'editing') return 'editing';
  if (v.stage === 'published') return 'published';
  return 'other';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function MediaCalendar({ videos, onOpen }: { videos: VishenVideo[]; onOpen: (v: VishenVideo) => void }) {
  const now = new Date();
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() });
  const [status, setStatus] = useState<StatusBucket | 'all'>('all');
  const [agency, setAgency] = useState<string>('all');
  const [channel, setChannel] = useState<string>('all');

  const filtered = useMemo(
    () => videos.filter((v) =>
      (status === 'all' || bucketOf(v) === status) &&
      (agency === 'all' || producerBucket(v.source) === agency) &&
      (channel === 'all' || v.channel === channel),
    ),
    [videos, status, agency, channel],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, VishenVideo[]>();
    for (const v of filtered) if (v.liveDate) (map.get(v.liveDate) ?? map.set(v.liveDate, []).get(v.liveDate)!).push(v);
    return map;
  }, [filtered]);

  const undated = useMemo(() => filtered.filter((v) => !v.liveDate), [filtered]);

  // Monday-first grid, padded to whole weeks.
  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysIn = new Date(ym.y, ym.m + 1, 0).getDate();
    const out: { date: Date; out: boolean }[] = [];
    for (let i = 0; i < lead; i++) out.push({ date: new Date(ym.y, ym.m, 1 - lead + i), out: true });
    for (let d = 1; d <= daysIn; d++) out.push({ date: new Date(ym.y, ym.m, d), out: false });
    for (let tail = 1; out.length % 7 !== 0; tail++) out.push({ date: new Date(ym.y, ym.m + 1, tail), out: true });
    return out;
  }, [ym]);

  const move = (delta: number) => setYm(({ y, m }) => {
    const nm = m + delta;
    return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
  });
  const todayKey = dateKey(now);
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const selCls = 'rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs text-text';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => move(-1)} aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-sm border border-border-strong bg-surface text-text-muted hover:bg-bg-subtle">‹</button>
          <span className="min-w-[150px] text-center font-display text-base font-bold text-text tabular-nums">{monthLabel}</span>
          <button onClick={() => move(1)} aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-sm border border-border-strong bg-surface text-text-muted hover:bg-bg-subtle">›</button>
          <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
            className="ml-1 rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg-subtle">Today</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusBucket | 'all')} className={selCls}>
            <option value="all">All statuses</option>
            <option value="production">In production</option>
            <option value="editing">In editing</option>
            <option value="review">To review</option>
            <option value="published">Published</option>
          </select>
          <select aria-label="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} className={selCls}>
            <option value="all">All agencies</option>
            {[...AGENCIES, 'Internal'].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={selCls}>
            <option value="all">All channels</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_250px]">
        {/* Grid */}
        <div>
          <div className="overflow-hidden rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
            <div className="grid grid-cols-7 border-b border-border-default bg-bg-subtle">
              {WEEKDAYS.map((d) => (
                <span key={d} className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-text-subtle">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c, i) => {
                const k = dateKey(c.date);
                const items = byDay.get(k) ?? [];
                return (
                  <div key={i} className={cn(
                    'flex min-h-[104px] flex-col gap-1 border-b border-r border-border-muted p-1.5 [&:nth-child(7n)]:border-r-0',
                    c.out && 'bg-bg-muted',
                  )}>
                    <div className={cn('px-1 text-[11.5px] font-bold tabular-nums',
                      c.out ? 'text-text-subtle opacity-60' : 'text-text-muted',
                      k === todayKey && 'grid h-[22px] w-[22px] place-items-center rounded-full bg-brand text-white')}>
                      {c.date.getDate()}
                    </div>
                    {items.slice(0, 3).map((v) => {
                      const needs = needsVishen(v);
                      const color = needs ? 'var(--gold)' : agencyColor(v.source);
                      return (
                        <button key={v.id} onClick={() => onOpen(v)}
                          className="flex items-center gap-1 overflow-hidden rounded-xs px-1.5 py-1 text-left text-[11px] font-medium text-text hover:brightness-95"
                          style={{ borderLeft: `3px solid ${color}`, background: `color-mix(in srgb, ${color} 14%, var(--surface))` }}>
                          {needs && <span className="flex-none text-warning-content" aria-hidden>⚑</span>}
                          <span className="min-w-0 flex-1 truncate">{v.name ?? 'Untitled'}</span>
                        </button>
                      );
                    })}
                    {items.length > 3 && <span className="pl-1 text-[10.5px] font-semibold text-text-subtle">+{items.length - 3} more</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-3.5 text-xs text-text-muted">
            {[...AGENCIES, 'Internal'].map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_META[a].token }} />{a}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 text-warning-content"><span aria-hidden>⚑</span> needs you</span>
          </div>
        </div>

        {/* No-date-yet rail — capped height so a big backlog scrolls in place, never a wall */}
        <div className="flex max-h-[560px] flex-col overflow-hidden rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)] lg:max-h-[640px]">
          <div className="flex flex-none items-center gap-2 border-b border-border-default px-3.5 py-3 text-[12.5px] font-bold text-text">
            <Icon name="inbox" size={15} /> No date yet
            <span className="ml-auto text-2xs font-semibold text-text-subtle">{undated.length}</span>
          </div>
          {undated.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-xs text-text-subtle">Everything has a date.</div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {undated.map((v) => (
                <button key={v.id} onClick={() => onOpen(v)}
                  className="flex w-full items-center gap-2.5 border-b border-border-muted px-3.5 py-2.5 text-left last:border-0 hover:bg-bg-subtle">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: agencyColor(v.source) }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text">{v.name}</span>
                  {needsVishen(v) && <span className="flex-none text-warning-content" aria-hidden>⚑</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
