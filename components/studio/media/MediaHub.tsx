'use client';

// The media hub tab shell. Owns the video + clip state, the mutation handlers (approve /
// send back / rate / 24h-data write straight back to Vishen's Videos base; clip approve /
// dismiss write to Clip Suggestions), the selected-record drawer, and the active tab.

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { approveVideo, sendBackVideo, rateVideo, saveViews24h } from '@/app/studio/media/actions';
import { approveClip, dismissClip } from '@/app/vishen/actions';
import type { VishenVideo } from '@/lib/media/vishen-videos';
import type { ClipSuggestion } from '@/lib/media/repository';
import { producerBucket, needsVishen, VideoDetail } from './shared';
import { MediaOverview } from './MediaOverview';
import { MediaCalendar } from './MediaCalendar';
import { ClipsPanel } from './ClipsPanel';
import { MediaBoard } from './MediaBoard';

type Tab = 'overview' | 'calendar' | 'clips' | 'board';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'list' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'clips', label: 'Clips & suggestions', icon: 'film' },
  { key: 'board', label: 'Board', icon: 'columns' },
];

export function MediaHub({ videos, proposedClips, approvedClips, sourceNames }: {
  videos: VishenVideo[];
  proposedClips: ClipSuggestion[];
  approvedClips: ClipSuggestion[];
  sourceNames: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [boardAgency, setBoardAgency] = useState('all');
  const [rows, setRows] = useState<VishenVideo[]>(videos);
  const [proposed, setProposed] = useState<ClipSuggestion[]>(proposedClips);
  const [approved, setApproved] = useState<ClipSuggestion[]>(approvedClips);
  const [selected, setSelected] = useState<VishenVideo | null>(null);
  const [pending, start] = useTransition();

  const waitingCount = rows.filter(needsVishen).length;

  // ── Video write-backs (optimistic local update + server write) ──
  function setApproval(id: string, approval: string, action: () => Promise<{ ok: boolean }>) {
    setRows((rs) => rs.map((v) => (v.id === id ? { ...v, approval } : v)));
    setSelected((s) => (s && s.id === id ? { ...s, approval } : s));
    start(async () => { await action(); });
  }
  const onApprove = (v: VishenVideo) => setApproval(v.id, 'Approved', () => approveVideo(v.id));
  const onSendBack = (v: VishenVideo) => setApproval(v.id, 'To Refine', () => sendBackVideo(v.id));
  function onRate(v: VishenVideo, rating: number) {
    setRows((rs) => rs.map((x) => (x.id === v.id ? { ...x, rating } : x)));
    setSelected((s) => (s && s.id === v.id ? { ...s, rating } : s));
    start(async () => { await rateVideo(v.id, rating); });
  }
  function onSaveViews(id: string, views24h: string) {
    setRows((rs) => rs.map((v) => (v.id === id ? { ...v, views24h } : v)));
    setSelected((s) => (s && s.id === id ? { ...s, views24h } : s));
    start(async () => { await saveViews24h(id, views24h); });
  }

  // ── Clip write-backs ──
  function onClipApprove(id: string) {
    const clip = proposed.find((c) => c.id === id);
    setProposed((cs) => cs.filter((c) => c.id !== id));
    if (clip) setApproved((cs) => [{ ...clip, status: 'Approved' }, ...cs]);
    start(async () => { await approveClip(id); });
  }
  function onClipDismiss(id: string) {
    setProposed((cs) => cs.filter((c) => c.id !== id));
    start(async () => { await dismissClip(id); });
  }

  return (
    <div className={cn(pending && 'opacity-95')}>
      {/* Tab bar */}
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-border-default bg-surface p-1 shadow-[var(--mv-shadow-light)]" role="tablist">
        {TABS.map((t) => {
          const on = tab === t.key;
          const pip = t.key === 'clips' && proposed.length ? proposed.length
            : t.key === 'overview' && waitingCount ? waitingCount : null;
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                on ? 'bg-brand text-white shadow-[var(--mv-shadow-light)]' : 'text-text-muted hover:bg-bg-subtle')}>
              <Icon name={t.icon} size={15} />
              {t.label}
              {pip != null && (
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                  on ? 'bg-white/25 text-white' : 'bg-gold-soft text-gold-content')}>{pip}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <MediaOverview rows={rows} onOpen={setSelected} onApprove={onApprove} onSendBack={onSendBack}
          onAgencyClick={(a) => { setBoardAgency(a); setTab('board'); }} />
      )}
      {tab === 'calendar' && <MediaCalendar videos={rows} onOpen={setSelected} />}
      {tab === 'clips' && (
        <ClipsPanel proposed={proposed} approved={approved} sourceNames={sourceNames} onApprove={onClipApprove} onDismiss={onClipDismiss} />
      )}
      {tab === 'board' && <MediaBoard key={boardAgency} rows={rows} onOpen={setSelected} initialAgency={boardAgency} />}

      {/* Trust footnote */}
      <p className="mt-8 flex items-start gap-3 rounded-md bg-brand-soft px-4 py-3.5 text-xs leading-relaxed text-brand-content">
        <span className="text-sm">🔒</span>
        <span><b>Nothing changes without you.</b> Approvals, ratings and clip sign-offs you make here write straight back to Airtable. The team advances everything else — this is your window onto their work, not a second system to maintain.</span>
      </p>

      {/* Detail drawer */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? `${producerBucket(selected.source)} · ${selected.channel}` : ''}
        title={selected?.name ?? 'Video'}
        footer={selected && needsVishen(selected) ? (
          <div className="flex gap-2.5">
            <button onClick={() => { onSendBack(selected); setSelected(null); }}
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg-subtle">Send back</button>
            <button onClick={() => { onApprove(selected); setSelected(null); }}
              className="flex-1 rounded-sm bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
          </div>
        ) : undefined}
      >
        {selected && (
          <VideoDetail key={selected.id} v={selected} onRate={(n) => onRate(selected, n)} onSaveViews={(t) => onSaveViews(selected.id, t)} />
        )}
      </DetailDrawer>
    </div>
  );
}
