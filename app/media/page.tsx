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
      <Link href="/media/new" className="card pad submit-cta no-underline">
        <div className="submit-cta-ic"><Icon name="film" size={24} /></div>
        <div className="cta-copy">
          <h3>Turn a talk into clips</h3>
          <p>Drop a YouTube or podcast link — we transcribe it and draft a ranked, platform-ready clip strategy.</p>
        </div>
        <span className="btn submit-cta-btn"><Icon name="plus" size={16} /> Submit media link</span>
      </Link>

      <KpiGrid>
        <Kpi label="Media in inbox" value={sources.length} i={0} />
        <Kpi tone="alert" label="Clips suggested" value={suggested} sub="ready to review" i={1} />
        <Kpi label="New / awaiting" value={fresh} sub="not yet processed" i={2} />
      </KpiGrid>

      {!res.ok && (
        <div className="banner bg-danger-soft text-danger-content mb-4">
          <Icon name="bolt" size={18} /> <div>Couldn’t load the inbox from Airtable: {res.error.message}</div>
        </div>
      )}

      <div className="sec-head"><h3>Media inbox</h3></div>
      {sources.length === 0 ? (
        <div className="empty">No media yet. <Link href="/media/new" className="font-semibold">Submit a YouTube link</Link>, or add a row in Airtable.</div>
      ) : (
        <div className="stack">
          {sources.map((s) => (
            <Link key={s.id} href={`/media/${s.id}`} className="mrow no-underline text-inherit">
              <div className="thumb"><Icon name="play" size={20} /></div>
              <div className="min-w-0 flex-1">
                <b className="text-sm">{s.title || s.sourceUrl || '(untitled)'}</b>
                <div className="t-meta">
                  {[s.guestShow, s.submittedVia, (s.submittedDate ?? s.createdTime)?.slice(0, 10)].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge tone={STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{s.status ?? 'New'}</Badge>
                <span className="muted w-16 text-right text-xs">{s.clipCount ? `${s.clipCount} clips` : '—'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
