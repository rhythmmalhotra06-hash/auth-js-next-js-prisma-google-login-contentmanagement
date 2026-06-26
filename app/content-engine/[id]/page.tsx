import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { getStrategy } from '@/lib/clipping/data';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { StrategyView } from '@/components/clipping/StrategyView';
import type { Strategy } from '@/lib/clipping/schema';

export const dynamic = 'force-dynamic';

export default async function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const strategy = await getStrategy(id);
  if (!strategy) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <AppNav active="Content Engine" />
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/content-engine" className="text-xs text-neutral-500 hover:text-[#572280]">← All strategies</Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">{strategy.contentSource.title}</h1>
            <p className="text-sm text-neutral-500">
              {strategy.contentSource.guestName ? `${strategy.contentSource.guestName} · ` : ''}
              {strategy.model}
              {strategy.usedWebSearch ? ' · web-search grounded' : ''}
            </p>
          </div>
        </div>

        {strategy.status === 'generating' && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-sm text-neutral-600">Generating strategy… this can take a minute. Refresh shortly.</p>
          </div>
        )}

        {strategy.status === 'error' && (
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              Generation failed: {strategy.error ?? 'unknown error'}
            </div>
            <Link href="/content-engine/new" className="mt-4 inline-block text-sm font-medium text-[#572280]">Try again →</Link>
          </div>
        )}

        {strategy.status === 'complete' && strategy.output && (
          <StrategyView
            strategyId={strategy.id}
            output={strategy.output as unknown as Strategy}
            clips={strategy.clips.map((c) => ({
              id: c.id,
              index: c.index,
              title: c.title,
              timestampStart: c.timestampStart,
              timestampEnd: c.timestampEnd,
              rationale: c.rationale,
              caption: c.caption,
              hookLine: c.hookLine,
              format: c.format,
              viralityScore: c.viralityScore,
              status: c.status,
              ticket: c.ticket,
            }))}
            reference={await getIntakeReferenceData()}
          />
        )}
      </div>
    </main>
  );
}
