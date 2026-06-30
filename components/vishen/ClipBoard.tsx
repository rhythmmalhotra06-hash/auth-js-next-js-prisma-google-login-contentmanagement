'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { ClipActions } from '@/components/vishen/ClipActions';
import type { ClipSuggestion } from '@/lib/media/repository';

type View = 'grid' | 'table';
type ClipSortKey = 'hook' | 'format' | 'virality';
type ClipSort = { key: ClipSortKey; dir: 'asc' | 'desc' } | null;

const CLIP_ACCESSOR: Record<ClipSortKey, (c: ClipSuggestion) => string | number | null> = {
  hook: (c) => (c.hookLine || c.name || '').toLowerCase(),
  format: (c) => (c.format ?? '').toLowerCase(),
  virality: (c) => c.viralityScore ?? null,
};

function sortClips(clips: ClipSuggestion[], sort: ClipSort): ClipSuggestion[] {
  if (!sort) return clips;
  const acc = CLIP_ACCESSOR[sort.key];
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...clips].sort((a, b) => {
    const av = acc(a), bv = acc(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
    return String(av).localeCompare(String(bv)) * mult;
  });
}

// AI-generated clips grouped by their media/asset source (compare side-by-side).
// Click a hook → open the clip record (full detail) and Approve / Dismiss there.
export function ClipBoard({ clips, sourceNames }: { clips: ClipSuggestion[]; sourceNames: Record<string, string> }) {
  const [view, setView] = useState<View>('grid');
  const [selected, setSelected] = useState<ClipSuggestion | null>(null);
  const [sort, setSort] = useState<ClipSort>(null);
  const toggleSort = (key: ClipSortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const groups = useMemo(() => {
    const m = new Map<string, ClipSuggestion[]>();
    for (const c of clips) {
      const key = c.mediaSourceId ?? '_none';
      (m.get(key) ?? m.set(key, []).get(key)!).push(c);
    }
    return [...m.entries()]
      .map(([id, cs]) => ({ id, name: sourceNames[id] ?? 'Other / unlinked', clips: cs }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clips, sourceNames]);

  const sourceName = selected ? sourceNames[selected.mediaSourceId ?? ''] ?? 'Source' : '';

  return (
    <div>
      <div className="subtabs" style={{ justifyContent: 'flex-end', marginTop: 0, marginBottom: 14 }}>
        {(['grid', 'table'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn('subtab', view === v && 'on')} style={{ textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>

      <div className="space-y-7">
        {groups.map((g) => (
          <section key={g.id}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-brand-soft text-xs text-brand-content">🎥</span>
              <h3 className="text-sm font-semibold text-text">{g.name}</h3>
              <Badge tone="neutral">{g.clips.length} clip{g.clips.length === 1 ? '' : 's'}</Badge>
            </div>

            {view === 'grid' ? (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {g.clips.map((c) => <ClipSummaryCard key={c.id} clip={c} onOpen={() => setSelected(c)} />)}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
                <table className="w-full text-sm">
                  <thead className="text-left text-2xs uppercase tracking-wide text-text-subtle">
                    <tr className="border-b border-border-default">
                      <ClipTh label="Hook" k="hook" sort={sort} onSort={toggleSort} />
                      <ClipTh label="Format" k="format" sort={sort} onSort={toggleSort} />
                      <ClipTh label="Virality" k="virality" sort={sort} onSort={toggleSort} align="right" />
                      <th className="px-4 py-2.5 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortClips(g.clips, sort).map((c) => (
                      <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-border-muted last:border-0 hover:bg-bg-subtle">
                        <td className="px-4 py-2.5 font-medium text-text">{c.hookLine || c.name || 'Untitled'}</td>
                        <td className="px-4 py-2.5 text-text-muted">{c.format?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text">{c.viralityScore ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-brand">→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="rounded-md border border-dashed border-border-default bg-surface px-5 py-8 text-center text-sm text-text-subtle">
            No clips awaiting approval. New AI suggestions appear here as media is processed.
          </p>
        )}
      </div>

      {/* Clip record */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={sourceName}
        title={selected?.hookLine || selected?.name || 'Clip'}
        footer={selected && <ClipActions clipId={selected.id} size="md" onDone={() => setSelected(null)} />}
      >
        {selected && <ClipDetail clip={selected} />}
      </DetailDrawer>
    </div>
  );
}

function ClipTh({ label, k, sort, onSort, align }: { label: string; k: ClipSortKey; sort: ClipSort; onSort: (k: ClipSortKey) => void; align?: 'right' }) {
  const active = sort?.key === k;
  const dir = active ? sort!.dir : undefined;
  return (
    <th className={cn('px-4 py-2.5', align === 'right' && 'text-right')} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)}
        className={cn('group inline-flex items-center gap-1 uppercase tracking-wide', align === 'right' && 'flex-row-reverse')}>
        <span>{label}</span>
        <Icon name="chevron" size={11}
          className={cn('transition-opacity', active ? 'text-brand opacity-100' : 'opacity-0 group-hover:opacity-40', dir === 'asc' && 'rotate-180')} />
      </button>
    </th>
  );
}

function ClipSummaryCard({ clip, onOpen }: { clip: ClipSuggestion; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-md border border-l-[3px] border-border-default border-l-gold bg-surface p-4 text-left shadow-[var(--mv-shadow-light)] transition-shadow hover:shadow-[var(--mv-shadow-medium)] focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-text">{clip.hookLine || clip.name || 'Untitled clip'}</h3>
        {clip.viralityScore != null && (
          <div className="flex-none rounded-[10px] bg-brand-soft px-2.5 py-1.5 text-center">
            <div className="text-lg font-bold leading-none text-brand-content tabular-nums">{clip.viralityScore}</div>
            <div className="text-2xs font-semibold uppercase tracking-wide text-brand">Virality</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {clip.format && <Badge tone="neutral">{clip.format.replace(/_/g, ' ')}</Badge>}
        {(clip.timestampStart || clip.timestampEnd) && (
          <span className="text-2xs tabular-nums text-text-subtle">{clip.timestampStart}{clip.timestampEnd ? `–${clip.timestampEnd}` : ''}</span>
        )}
      </div>
      {clip.caption && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{clip.caption}</p>}
      <span className="text-xs font-semibold text-brand">Open record →</span>
    </button>
  );
}

function ClipDetail({ clip }: { clip: ClipSuggestion }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {clip.viralityScore != null && <Badge tone="brand">Virality {clip.viralityScore}/10</Badge>}
        {clip.format && <Badge tone="neutral">{clip.format.replace(/_/g, ' ')}</Badge>}
        {(clip.timestampStart || clip.timestampEnd) && (
          <Badge tone="neutral">{clip.timestampStart}{clip.timestampEnd ? `–${clip.timestampEnd}` : ''}</Badge>
        )}
      </div>
      {clip.rationale && (
        <Section label="What it presents">{clip.rationale}</Section>
      )}
      {clip.caption && (
        <Section label="Caption">{clip.caption}</Section>
      )}
      {clip.hookLine && (
        <Section label="Hook line">{clip.hookLine}</Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-text-subtle">{label}</div>
      <p className="leading-relaxed text-text">{children}</p>
    </div>
  );
}
