'use client';

// Board tab — the full, filterable "every video" table for power browsing. Keeps the
// founder-board columns (Title · Rating · Made by · Status · Sign-off · Channel · Live link · Live date).

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import type { VishenVideo, VideoChannel } from '@/lib/media/vishen-videos';
import { AGENCIES, producerBucket, STAGE_LABEL, STAGE_TONE, APPROVAL_TONE, AgencyChip, Stars } from './shared';

type TimeWindow = 'all' | 'year' | '30';
const CHANNELS: VideoChannel[] = ['YouTube', 'LinkedIn', 'Instagram', 'Email', 'Web'];
const COLUMNS = ['Title', 'Rating', 'Made by', 'Status', 'Sign-off', 'Channel', 'Live link', 'Live date'];

export function MediaBoard({ rows, onOpen, initialAgency = 'all' }: {
  rows: VishenVideo[]; onOpen: (v: VishenVideo) => void; initialAgency?: string;
}) {
  const [agency, setAgency] = useState(initialAgency);
  const [channel, setChannel] = useState('all');
  const [time, setTime] = useState<TimeWindow>('all');

  const since30 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }, []);
  const visible = useMemo(() => {
    const inTime = (v: VishenVideo) => {
      if (time === 'all') return true;
      if (!v.liveDate) return false;
      if (time === 'year') return v.liveDate.slice(0, 4) === String(new Date().getFullYear());
      return v.liveDate >= since30;
    };
    return rows.filter((v) =>
      (agency === 'all' || producerBucket(v.source) === agency) &&
      (channel === 'all' || v.channel === channel) &&
      inTime(v));
  }, [rows, agency, channel, time, since30]);

  const selCls = 'rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs text-text';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} className={selCls}>
          <option value="all">All agencies</option>
          {[...AGENCIES, 'Internal'].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={selCls}>
          <option value="all">All channels</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Time" value={time} onChange={(e) => setTime(e.target.value as TimeWindow)} className={selCls}>
          <option value="all">All time</option>
          <option value="year">This year</option>
          <option value="30">Last 30 days</option>
        </select>
        <span className="ml-auto text-xs text-text-subtle">{visible.length} of {rows.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-2xs uppercase tracking-wide text-text-subtle">
              {COLUMNS.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id} onClick={() => onOpen(v)}
                className={cn('cursor-pointer border-b border-border-muted last:border-0 hover:bg-bg-subtle')}>
                <td className="max-w-[280px] px-4 py-3">
                  <div className="truncate font-medium text-text">{v.name}</div>
                  {v.medium && <div className="truncate text-2xs text-text-subtle">{v.medium}{v.format ? ` · ${v.format}` : ''}</div>}
                </td>
                <td className="px-4 py-3"><Stars n={v.rating} /></td>
                <td className="whitespace-nowrap px-4 py-3"><AgencyChip source={v.source} /></td>
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
              <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm text-text-subtle">No videos match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
