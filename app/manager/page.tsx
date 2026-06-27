import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { getQueueTickets } from '@/lib/tickets/data';
import { ReorderableQueue } from '@/components/tickets/ReorderableQueue';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const [tickets, approvedRes, sourcesRes] = await Promise.all([
    getQueueTickets(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    (sourcesRes.ok ? sourcesRes.data : []).map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );

  return (
    <AppShell
      title="Manager — Prioritization Queue"
      subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'} · all teams · ordered by priority score`}
    >
      {/* Vishen-approved clips waiting to be converted into tickets */}
      {approved.length > 0 && (
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
      )}

      <ReorderableQueue tickets={tickets} />
    </AppShell>
  );
}
