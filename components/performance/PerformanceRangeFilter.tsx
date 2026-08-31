'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export type PerformanceRange = '7' | '30' | 'custom';

const isoToday = (): string => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

/**
 * 7 / 30 / custom date filter for the Performance page, in the spirit of Instagram's
 * Insights date picker. "Last 7 days" and "Last 30 days" are free — they read the
 * already-cached Perch windows the Slack digests also use. "Custom" is not shown at all
 * unless `canCustom`: picking an arbitrary range means a live Hootsuite call every time
 * (~10-15s), and that pipeline is known to rate-limit under repeated hits, so it's
 * restricted server-side to admins + the Studio allowlist (see the page for the gate).
 */
export function PerformanceRangeFilter({ range, from, to, canCustom }: {
  range: PerformanceRange;
  from: string;
  to: string;
  canCustom: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const go = (params: Record<string, string>) => {
    router.push(`${pathname}?${new URLSearchParams(params).toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="segmented" role="group" aria-label="Date range">
        <button type="button" aria-pressed={range === '7'} className={cn(range === '7' && 'on')} onClick={() => go({ range: '7' })}>
          Last 7 days
        </button>
        <button type="button" aria-pressed={range === '30'} className={cn(range === '30' && 'on')} onClick={() => go({ range: '30' })}>
          Last 30 days
        </button>
        {canCustom && (
          <button
            type="button"
            aria-pressed={range === 'custom'}
            className={cn(range === 'custom' && 'on')}
            onClick={() => go({ range: 'custom', from: draftFrom || isoDaysAgo(30), to: draftTo || isoToday() })}
          >
            Custom
          </button>
        )}
      </div>

      {canCustom && range === 'custom' && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); go({ range: 'custom', from: draftFrom, to: draftTo }); }}
        >
          <Input
            type="date"
            value={draftFrom}
            max={draftTo || isoToday()}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="h-8 w-[150px] text-xs"
            aria-label="From date"
          />
          <span className="text-2xs text-text-subtle">to</span>
          <Input
            type="date"
            value={draftTo}
            min={draftFrom}
            max={isoToday()}
            onChange={(e) => setDraftTo(e.target.value)}
            className="h-8 w-[150px] text-xs"
            aria-label="To date"
          />
          <Button type="submit" variant="secondary" size="sm">Apply</Button>
          <span className="text-2xs text-text-subtle">queries Hootsuite live · ~10-15s</span>
        </form>
      )}
    </div>
  );
}
