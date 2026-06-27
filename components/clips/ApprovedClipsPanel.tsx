import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import type { ClipSuggestion } from '@/lib/media/repository';

// Vishen-approved clips waiting to be converted into tickets. Surfaced in the
// Manager and Editor views (read-only here; convert opens the media source).
export function ApprovedClipsPanel({ approved, sourceNames }: {
  approved: ClipSuggestion[];
  sourceNames: Record<string, string>;
}) {
  if (approved.length === 0) return null;
  return (
    <section className="mb-7 rounded-[12px] border border-border-default bg-surface p-4 shadow-[var(--mv-shadow-light)]">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="text-[15px] font-bold tracking-tight text-text">Approved by Vishen — ready to convert</h2>
        <Badge tone="success">{approved.length}</Badge>
      </div>
      <ul className="divide-y divide-border-muted">
        {approved.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{c.hookLine || c.name || 'Clip'}</p>
              <p className="truncate text-[12px] text-text-muted">
                {sourceNames[c.mediaSourceId ?? ''] ?? 'Source'}
                {c.format ? ` · ${c.format.replace(/_/g, ' ')}` : ''}
                {c.viralityScore != null ? ` · virality ${c.viralityScore}` : ''}
              </p>
            </div>
            {c.mediaSourceId && (
              <Link href={`/media/${c.mediaSourceId}`} className="flex-none rounded-[8px] border border-border-default px-3 py-1.5 text-[13px] font-semibold text-brand hover:bg-bg-subtle">
                Convert to ticket →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
