import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { ClipBoard } from '@/components/vishen/ClipBoard';
import { NewMediaCard } from '@/components/vishen/NewMediaCard';
import { listMediaSources, listClipsByStatus } from '@/lib/media/repository';

// Clips — the AI clip engine, focused: add media → clips proposed (approval gate,
// grouped by source) → approved (convert to tickets). Live from Airtable.
export const dynamic = 'force-dynamic';

export default async function ClipsPage() {
  const [sourcesRes, proposedRes, approvedRes] = await Promise.all([
    listMediaSources(100),
    listClipsByStatus('Proposed'),
    listClipsByStatus('Approved'),
  ]);

  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const proposed = proposedRes.ok ? proposedRes.data : [];
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );

  return (
    <AppShell title="Clips" subtitle="Generate, review, and approve AI clips from media.">
      {/* Clip-focused KPIs */}
      <KpiGrid>
        <Kpi label="Media in inbox" value={sources.length} i={0} />
        <Kpi tone="alert" label="Clips awaiting you" value={proposed.length} i={1} />
        <Kpi label="Approved, ready" value={approved.length} sub="to convert" i={2} />
      </KpiGrid>

      {/* Add media → generate clips */}
      <div className="mt-5"><NewMediaCard /></div>

      {/* Approval gate — AI clips grouped by source */}
      <div className="mt-9">
        <h2 className="text-lg font-bold tracking-tight text-text">Awaiting your approval</h2>
        <p className="mt-0.5 text-[13.5px] text-text-muted">AI-generated clips, grouped by source. Approve to send to production, or dismiss.</p>
      </div>
      <div className="mt-4"><ClipBoard clips={proposed} sourceNames={sourceNames} /></div>
      {/* Approved clips ("ready to convert") now surface in the Manager (and Editor) view. */}
    </AppShell>
  );
}
