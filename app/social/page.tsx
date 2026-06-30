import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { requireSocialAccess } from '@/lib/social/guard';
import { listSocialSuggestions, listSocialAssetTypes } from '@/lib/social/repository';
import { SocialBoard } from '@/components/social/SocialBoard';

export const dynamic = 'force-dynamic';

export default async function SocialPage() {
  await requireSocialAccess();

  const [sugRes, atRes] = await Promise.all([listSocialSuggestions(), listSocialAssetTypes()]);
  const suggestions = sugRes.ok ? sugRes.data : [];
  const assetTypes = atRes.ok ? atRes.data : [];

  const proposals = suggestions.filter((s) => (s.status ?? '').startsWith('1')).length;
  const raised = suggestions.filter((s) => s.ticketRaised || (s.status ?? '').startsWith('2A')).length;

  return (
    <AppShell
      title="Social Media"
      subtitle="Long-form media → AI clip suggestions → social tickets. Propose-only — a ticket is raised only when you check the box."
    >
      <Link href="/social/new" className="card pad submit-cta" style={{ textDecoration: 'none' }}>
        <div className="submit-cta-ic"><Icon name="share" size={24} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ fontSize: 19, color: '#fff' }}>Turn a talk into social clips</h3>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.92)', margin: '4px 0 0' }}>
            Drop a YouTube or podcast link — we transcribe it and draft ranked, platform-ready clip suggestions.
          </p>
        </div>
        <span className="btn submit-cta-btn"><Icon name="plus" size={16} /> Generate clip suggestions</span>
      </Link>

      <KpiGrid>
        <Kpi label="Suggestions" value={suggestions.length} i={0} />
        <Kpi tone="alert" label="Awaiting review" value={proposals} sub="proposed, not yet actioned" i={1} />
        <Kpi label="Tickets raised" value={raised} sub="sent to production" i={2} />
      </KpiGrid>

      {!sugRes.ok && (
        <div className="banner" style={{ background: 'var(--red-soft)', color: 'var(--red-content)', marginBottom: 16 }}>
          <Icon name="bolt" size={18} /> <div>Couldn’t load suggestions from Airtable: {sugRes.error.message}</div>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 6 }}><h3>Clip suggestions</h3></div>
      <SocialBoard suggestions={suggestions} assetTypes={assetTypes} />
    </AppShell>
  );
}
