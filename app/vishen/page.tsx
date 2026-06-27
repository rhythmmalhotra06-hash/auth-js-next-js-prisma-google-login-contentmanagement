import { AppShell } from '@/components/ui/AppShell';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';
import { ClipBoard } from '@/components/vishen/ClipBoard';
import { listMediaSources, listClipsByStatus } from '@/lib/media/repository';
import { getQueueTickets } from '@/lib/tickets/data';
import { countTicketsByStatus } from '@/lib/repositories/ticket.repository';

// Vishen's Content Engine cockpit — the engine as one funnel, live from Airtable.
// Media in → clips proposed (his approval gate, grouped by source) → in production
// → published. Performance (CTR/ROAS) is Phase 2 (no posting/results data yet).
export const dynamic = 'force-dynamic';

export default async function VishenCockpitPage() {
  const [sourcesRes, proposedRes, approvedRes, tickets, published] = await Promise.all([
    listMediaSources(100),
    listClipsByStatus('Proposed'),
    listClipsByStatus('Approved'),
    getQueueTickets(),
    countTicketsByStatus(['Shipping', 'Done']),
  ]);

  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const proposed = proposedRes.ok ? proposedRes.data : [];
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );
  const editors = new Set(tickets.map((t) => t.assignee).filter(Boolean)).size;

  return (
    <AppShell title="Content Engine" subtitle="Media in → clips proposed → in production → published.">
      {/* KPI strip */}
      <MetricGrid>
        <MetricCard label="Media in inbox" value={sources.length} />
        <MetricCard label="Clips awaiting you" value={proposed.length} className="border-gold" />
        <MetricCard label="Approved, ready" value={approved.length} />
        <MetricCard label="In production" value={tickets.length} />
        <MetricCard label="Published" value={published} />
        <MetricCard label="Active editors" value={editors} />
      </MetricGrid>

      {/* Funnel */}
      <h2 className="mt-9 text-lg font-bold tracking-tight text-text">Pipeline</h2>
      <p className="mt-0.5 text-[13.5px] text-text-muted">What the engine is producing, stage by stage.</p>
      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-border-default bg-border-default shadow-[var(--mv-shadow-light)] sm:grid-cols-2 lg:grid-cols-4">
        <FunnelLane icon="🎥" name="Media Sources" count={sources.length} sub="in inbox"
          items={sources.slice(0, 3).map((s) => s.title || s.sourceUrl || 'Untitled source')} />
        <FunnelLane icon="✂️" name="Clip Suggestions" count={proposed.length} sub="proposed" dot="var(--mv-gold)"
          items={proposed.slice(0, 3).map((c) => c.hookLine || c.name || 'Clip')} />
        <FunnelLane icon="🎬" name="Tickets" count={tickets.length} sub="in production"
          items={tickets.slice(0, 3).map((t) => `${t.title}${t.ticketStatus ? ` · ${t.ticketStatus}` : ''}`)} />
        <FunnelLane icon="🚀" name="Published" count={published} sub="shipped / done" items={[]} />
      </div>

      {/* Approval gate — AI clips generated, grouped by source */}
      <div className="mt-9 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text">Awaiting your approval</h2>
          <p className="mt-0.5 text-[13.5px] text-text-muted">AI-generated clips, grouped by source. Approve to send to production, or dismiss.</p>
        </div>
      </div>
      <div className="mt-4"><ClipBoard clips={proposed} sourceNames={sourceNames} /></div>

      {approved.length > 0 && (
        <>
          <h2 className="mt-9 text-lg font-bold tracking-tight text-text">Approved — ready to convert</h2>
          <div className="mt-4"><ClipBoard clips={approved} sourceNames={sourceNames} /></div>
        </>
      )}

      {/* Performance — Phase 2 */}
      <h2 className="mt-9 text-lg font-bold tracking-tight text-text">Published performance</h2>
      <div className="mt-4 flex items-center gap-4 rounded-[12px] border border-dashed border-brand-border bg-brand-soft px-5 py-5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-surface text-xl">📊</span>
        <div>
          <div className="text-[14.5px] font-bold text-brand-content">Performance loop — coming in Phase 2</div>
          <div className="mt-0.5 max-w-[62ch] text-[13px] text-text-muted">
            Once posting and results data are connected, each published clip shows live CTR &amp; ROAS here.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FunnelLane({ icon, name, count, sub, items, dot }: {
  icon: string; name: string; count: number; sub: string; items: string[]; dot?: string;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-brand-soft text-xs text-brand-content">{icon}</span>
        <span className="text-[12.5px] font-semibold text-text-muted">{name}</span>
      </div>
      <div className="mt-2 text-[26px] font-bold tracking-tight text-text tabular-nums">{count}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">{sub}</div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] text-text">
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dot ?? 'var(--mv-text-subtle)' }} />
            <span className="truncate">{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
