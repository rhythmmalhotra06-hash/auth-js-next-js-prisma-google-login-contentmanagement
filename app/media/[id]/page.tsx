import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
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
      <main className="min-h-screen bg-neutral-50 py-10">
        <div className="mx-auto max-w-3xl px-4">
          <AppNav active="Media" />
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Couldn’t load: {srcRes.error.message}</div>
        </div>
      </main>
    );
  }
  const source = srcRes.data;

  const [clipsRes, reference] = await Promise.all([listClipSuggestions(id), getIntakeReferenceData()]);
  const clips = clipsRes.ok ? clipsRes.data : [];

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <AppNav active="Media" />
        <div className="mb-6">
          <Link href="/media" className="text-sm text-neutral-500 hover:text-[#572280]">← Inbox</Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">{source.title || source.sourceUrl || '(untitled)'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
            {source.sourceUrl && (
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-[#572280] hover:underline">
                {source.platform ?? 'Link'} ↗
              </a>
            )}
            {source.guestShow && <span>{source.guestShow}</span>}
            {source.submittedVia && <span>· via {source.submittedVia}</span>}
          </div>
        </div>

        <MediaDetailClient
          sourceId={source.id}
          sourceUrl={source.sourceUrl}
          status={source.status}
          error={source.error}
          clips={clips}
          reference={reference}
        />
      </div>
    </main>
  );
}
