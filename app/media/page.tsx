import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ConvertCheckedButton } from '@/components/media/ConvertCheckedButton';
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
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <ConvertCheckedButton />
          <Link href="/media/new" className="btn primary sm" style={{ textDecoration: 'none' }}><Icon name="plus" size={14} /> Submit link</Link>
        </div>
      }
    >
      <div className="banner future" style={{ marginBottom: 16 }}>
        <Icon name="film" size={18} />
        <div>Vishen’s long-form talks are transcribed and turned into a ranked clip strategy. Approve the winners and <b>batch-convert them into production tickets</b>.</div>
      </div>

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
