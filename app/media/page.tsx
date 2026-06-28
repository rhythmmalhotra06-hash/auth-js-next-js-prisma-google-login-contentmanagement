import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'brand' | 'danger'> = {
  'New': 'neutral',
  'Transcribing': 'info',
  'Clips Suggested': 'brand',
  'Error': 'danger',
};

export default async function MediaInboxPage() {
  const res = await listMediaSources();
  const sources = res.ok ? res.data : [];
  const suggested = sources.filter((s) => s.status === 'Clips Suggested').length;
  const fresh = sources.filter((s) => (s.status ?? 'New') === 'New').length;

  return (
    <AppShell
      title="Clip engine"
      subtitle="Long-form media → AI clip strategy → production tickets."
    >
      {/* Submit is the key action of this workflow — lead with it. */}
      <Link href="/media/new" className="card pad submit-cta" style={{ textDecoration: 'none' }}>
        <div className="submit-cta-ic"><Icon name="film" size={24} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ fontSize: 19, color: '#fff' }}>Turn a talk into clips</h3>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.92)', margin: '4px 0 0' }}>
            Drop a YouTube or podcast link — we transcribe it and draft a ranked, platform-ready clip strategy.
          </p>
        </div>
        <span className="btn submit-cta-btn"><Icon name="plus" size={16} /> Submit media link</span>
      </Link>

      <KpiGrid>
        <Kpi label="Media in inbox" value={sources.length} i={0} />
        <Kpi tone="alert" label="Clips suggested" value={suggested} sub="ready to review" i={1} />
        <Kpi label="New / awaiting" value={fresh} sub="not yet processed" i={2} />
      </KpiGrid>

      {!res.ok && (
        <div className="banner" style={{ background: 'var(--red-soft)', color: 'var(--red-content)', marginBottom: 16 }}>
          <Icon name="bolt" size={18} /> <div>Couldn’t load the inbox from Airtable: {res.error.message}</div>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 6 }}><h3>Media inbox</h3></div>
      {sources.length === 0 ? (
        <div className="empty">No media yet. <Link href="/media/new" style={{ fontWeight: 600 }}>Submit a YouTube link</Link>, or add a row in Airtable.</div>
      ) : (
        <div className="stack">
          {sources.map((s) => (
            <Link key={s.id} href={`/media/${s.id}`} className="mrow" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="thumb"><Icon name="play" size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{s.title || s.sourceUrl || '(untitled)'}</b>
                <div className="t-meta">
                  {[s.guestShow, s.submittedVia, (s.submittedDate ?? s.createdTime)?.slice(0, 10)].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Badge tone={STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{s.status ?? 'New'}</Badge>
                <span className="muted" style={{ fontSize: 12, width: 70, textAlign: 'right' }}>{s.clipCount ? `${s.clipCount} clips` : '—'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
