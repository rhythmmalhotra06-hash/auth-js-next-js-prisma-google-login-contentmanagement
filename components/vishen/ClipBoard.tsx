'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { ClipApprovalCard } from '@/components/vishen/ClipApprovalCard';
import { ClipActions } from '@/components/vishen/ClipActions';
import type { ClipSuggestion } from '@/lib/media/repository';

type View = 'grid' | 'table';

// AI-generated clips, grouped by their media/asset source so clips from the same
// source compare side-by-side. Grid (cards) or table view.
export function ClipBoard({ clips, sourceNames }: { clips: ClipSuggestion[]; sourceNames: Record<string, string> }) {
  const [view, setView] = useState<View>('grid');

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

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <div className="inline-flex rounded-[8px] border border-border-default bg-surface p-0.5 text-sm">
          {(['grid', 'table'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn('rounded-[6px] px-3 py-1 capitalize transition-colors',
                view === v ? 'bg-brand text-white' : 'text-text-muted hover:text-text')}
            >
              {v}
            </button>
          ))}
        </div>
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
                {g.clips.map((c) => <ClipApprovalCard key={c.id} clip={c} />)}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10.5px] uppercase tracking-wide text-text-subtle">
                    <tr className="border-b border-border-default">
                      <th className="px-4 py-2.5">Hook</th>
                      <th className="px-4 py-2.5">Format</th>
                      <th className="px-4 py-2.5 text-right">Virality</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.clips.map((c) => (
                      <tr key={c.id} className="border-b border-border-muted last:border-0 hover:bg-bg-subtle">
                        <td className="px-4 py-2.5 font-medium text-text">{c.hookLine || c.name || 'Untitled'}</td>
                        <td className="px-4 py-2.5 text-text-muted">{c.format?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text">{c.viralityScore ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {c.status === 'Approved' ? <Badge tone="success">Approved</Badge> : <Badge tone="neutral">Proposed</Badge>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.status === 'Approved' && c.mediaSourceId ? (
                            <Link href={`/media/${c.mediaSourceId}`} className="text-[13px] font-semibold text-brand hover:underline">Convert →</Link>
                          ) : (
                            <div className="flex justify-end"><ClipActions clipId={c.id} /></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-border-default bg-surface px-5 py-8 text-center text-sm text-text-subtle">
            No clips yet. New AI suggestions appear here as media is processed.
          </p>
        )}
      </div>
    </div>
  );
}
