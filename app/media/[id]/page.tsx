import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { getMediaSource, listClipSuggestions } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { MediaDetailClient } from '@/components/media/MediaDetailClient';

export const dynamic = 'force-dynamic';

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const srcRes = await getMediaSource(id);
  if (!srcRes.ok) {
    if (srcRes.error.type === 'NOT_FOUND') notFound();
    return (
      <AppShell title="Media">
        <div className="rounded-[8px] bg-red-50 px-4 py-3 text-sm text-danger">Couldn’t load: {srcRes.error.message}</div>
      </AppShell>
    );
  }
  const source = srcRes.data;

  const [clipsRes, reference] = await Promise.all([listClipSuggestions(id), getIntakeReferenceData()]);
  const clips = clipsRes.ok ? clipsRes.data : [];

  const subtitleParts = [source.guestShow, source.submittedVia ? `via ${source.submittedVia}` : null].filter(Boolean);

  return (
    <AppShell
      title={source.title || source.sourceUrl || '(untitled)'}
      subtitle={subtitleParts.join(' · ') || undefined}
      actions={
        source.sourceUrl ? (
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">
            {source.platform ?? 'Link'} ↗
          </a>
        ) : undefined
      }
    >
      <Link href="/media" className="text-sm text-brand hover:underline">← Inbox</Link>

      <div className="mt-3">
        <MediaDetailClient
          sourceId={source.id}
          sourceUrl={source.sourceUrl}
          status={source.status}
          error={source.error}
          clips={clips}
          reference={reference}
        />
      </div>
    </AppShell>
  );
}
