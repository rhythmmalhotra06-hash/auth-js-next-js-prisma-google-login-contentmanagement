import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { getMediaSource, listClipSuggestions, type MediaSource } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { MediaDetailClient } from '@/components/media/MediaDetailClient';
import { CardSkeleton } from '@/components/ui/Skeletons';

export const dynamic = 'force-dynamic';

async function MediaBody({ source, autostart }: { source: MediaSource; autostart: boolean }) {
  // Reuse the link ids already on the source record (Tier 1) + getIntakeReferenceData
  // streams independently behind this boundary so the page chrome paints first.
  const [clipsRes, reference] = await Promise.all([
    listClipSuggestions(source.id, source.clipSuggestionIds),
    getIntakeReferenceData(),
  ]);
  const clips = clipsRes.ok ? clipsRes.data : [];

  return (
    <MediaDetailClient
      sourceId={source.id}
      sourceUrl={source.sourceUrl}
      status={source.status}
      error={source.error}
      clips={clips}
      reference={reference}
      autostart={autostart}
    />
  );
}

export default async function MediaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autostart?: string }>;
}) {
  const { id } = await params;
  const { autostart } = await searchParams;

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
        <Suspense fallback={<CardSkeleton height={300} />}>
          <MediaBody source={source} autostart={autostart === '1'} />
        </Suspense>
      </div>
    </AppShell>
  );
}
