'use client';

// Clips & suggestions tab — master–detail, grouped by the source ("main") video so ~100
// clips read as ~10 videos you drill into, not a wall. A toggle switches between the clips
// awaiting sign-off and the approved ones (one set at a time). Calm cards, no gradient caps.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { ClipSuggestion } from '@/lib/media/repository';

type Which = 'proposed' | 'approved';
interface Group { id: string; name: string; clips: ClipSuggestion[] }

function groupBySource(clips: ClipSuggestion[], sourceNames: Record<string, string>): Group[] {
  const m = new Map<string, ClipSuggestion[]>();
  for (const c of clips) {
    const key = c.mediaSourceId ?? '_none';
    (m.get(key) ?? m.set(key, []).get(key)!).push(c);
  }
  return [...m.entries()]
    .map(([id, cs]) => ({ id, name: id === '_none' ? 'Other / unlinked' : (sourceNames[id] ?? 'Other / unlinked'), clips: cs }))
    .sort((a, b) => b.clips.length - a.clips.length || a.name.localeCompare(b.name));
}

export function ClipsPanel({ proposed, approved, sourceNames, onApprove, onDismiss }: {
  proposed: ClipSuggestion[];
  approved: ClipSuggestion[];
  sourceNames: Record<string, string>;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [which, setWhich] = useState<Which>('proposed');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(
    () => groupBySource(which === 'proposed' ? proposed : approved, sourceNames),
    [which, proposed, approved, sourceNames],
  );

  // Keep the selection valid as groups change (approve/dismiss empties one, or the toggle flips).
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Status toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="segmented" role="group" aria-label="Which clips">
          <button type="button" aria-pressed={which === 'proposed'} className={cn(which === 'proposed' && 'on')}
            onClick={() => { setWhich('proposed'); setSelectedId(null); }}>Awaiting you · {proposed.length}</button>
          <button type="button" aria-pressed={which === 'approved'} className={cn(which === 'approved' && 'on')}
            onClick={() => { setWhich('approved'); setSelectedId(null); }}>Approved · {approved.length}</button>
        </div>
        <span className="text-xs text-text-subtle">{groups.length} source video{groups.length === 1 ? '' : 's'}</span>
      </div>

      {groups.length === 0 || !selected ? (
        <Empty>{which === 'proposed' ? 'No clips waiting — all reviewed. 🎉' : 'Nothing approved yet.'}</Empty>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_1fr]">
          {/* Master — source-video list */}
          <div className="flex max-h-[300px] flex-col overflow-hidden rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)] lg:max-h-[640px]">
            <div className="flex-none border-b border-border-default px-3.5 py-2.5 text-2xs font-bold uppercase tracking-wide text-text-subtle">Source videos</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {groups.map((g) => {
                const on = g.id === selected.id;
                return (
                  <button key={g.id} onClick={() => setSelectedId(g.id)}
                    className={cn('flex w-full items-center gap-2.5 border-b border-border-muted px-3.5 py-3 text-left last:border-0',
                      on ? 'border-l-[3px] border-l-brand bg-brand-soft' : 'border-l-[3px] border-l-transparent hover:bg-bg-subtle')}>
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-[7px] bg-brand-soft text-xs text-brand-content">🎬</span>
                    <span className={cn('min-w-0 flex-1 truncate text-[13px]', on ? 'font-semibold text-text' : 'font-medium text-text-muted')}>{g.name}</span>
                    <Badge tone={on ? 'brand' : 'neutral'}>{g.clips.length}</Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail — the selected video's clips */}
          <div>
            <div className="mb-3 flex items-baseline gap-3">
              <h3 className="font-display text-base font-bold text-text">{selected.name}</h3>
              <span className="text-xs text-text-subtle">{selected.clips.length} clip{selected.clips.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
              {selected.clips.map((c) => (
                <ClipCard key={c.id} clip={c}
                  actions={which === 'proposed' ? (
                    <>
                      <button onClick={() => onDismiss(c.id)} className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-subtle">Dismiss</button>
                      <button onClick={() => onApprove(c.id)} className="flex-1 rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-content"><Icon name="check" size={13} /> Approved · ready to ship</span>
                  )} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClipCard({ clip, actions }: { clip: ClipSuggestion; actions: React.ReactNode }) {
  const ts = clip.timestampStart && clip.timestampEnd ? `${clip.timestampStart}–${clip.timestampEnd}` : clip.timestampStart;
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-l-[3px] border-border-default border-l-gold bg-surface p-4 shadow-[var(--mv-shadow-light)]">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[13.5px] font-semibold leading-snug text-text">{clip.hookLine || clip.name || 'Untitled clip'}</h4>
        {clip.viralityScore != null && (
          <span className="flex-none rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold tabular-nums text-brand-content">{clip.viralityScore}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {clip.format && <Badge tone="neutral">{clip.format.replace(/_/g, ' ')}</Badge>}
        {ts && <span className="text-2xs tabular-nums text-text-subtle">{ts}</span>}
      </div>
      {clip.caption && <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">{clip.caption}</p>}
      <div className="mt-auto flex items-center gap-2 pt-0.5">{actions}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border-default bg-surface px-4 py-8 text-center text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">{children}</div>;
}
