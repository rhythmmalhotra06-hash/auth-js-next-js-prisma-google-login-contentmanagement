import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { getMediaSource, listClipSuggestions, type MediaSource } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { MediaDetailClient } from '@/components/media/MediaDetailClient';
import { MediaHero } from '@/components/media/MediaHero';
import { CardSkeleton } from '@/components/ui/Skeletons';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

async function MediaBody({ source, autostart }: { source: MediaSource; autostart: boolean }) {
  // Load clips + intake reference in parallel; reference feeds the inline "Convert to ticket"
  // modal so editors can raise a ticket straight from an approved clip (parity with /manager).
  const [clipsRes, reference] = await Promise.all([
    listClipSuggestions(source.id, source.clipSuggestionIds),
    getIntakeReferenceData(),
  ]);
  const clips = clipsRes.ok ? clipsRes.data : [];

  return (
    <MediaDetailClient
      sourceId={source.id}
      status={source.status}
      error={source.error}
      clips={clips}
      strategyJson={source.strategyJson}
      autostart={autostart}
      reference={reference}
      sourceUrl={source.sourceUrl}
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
        <div className="banner bg-danger-soft text-danger-content">
          <Icon name="bolt" size={18} /> <div>Couldn’t load: {srcRes.error.message}</div>
        </div>
      </AppShell>
    );
  }
  const source = srcRes.data;

  return (
    <AppShell title="Clips" subtitle={source.guestShow || undefined}>
      <Link href="/media" className="st-back">
        <Icon name="arrow" size={14} className="rotate-180" /> All clips
      </Link>

      <div className="space-y-6">
        <MediaHero source={source} />
        <Suspense fallback={<CardSkeleton height={300} />}>
          <MediaBody source={source} autostart={autostart === '1'} />
        </Suspense>
      </div>
    </AppShell>
  );
}
