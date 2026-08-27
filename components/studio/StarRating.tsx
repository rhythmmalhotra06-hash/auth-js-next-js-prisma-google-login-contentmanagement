'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { setPriorityRank } from '@/app/studio/actions';
import { QUEUE_RANK_MAX } from '@/lib/tickets/constants';

const STARS = Array.from({ length: QUEUE_RANK_MAX }, (_, i) => i + 1);

/** Editable priority rank — writes the 2-way-synced "Priority ranking (Manual)" field.
 *  Star count tracks the Airtable rating field's max so every value it can hold is
 *  settable here; previously the control stopped at 5 and silently could not express
 *  (or write back) a 6–10 set in Airtable. */
export function StarRating({ ticketId, value, compact = false }: { ticketId: string; value: number | null; compact?: boolean }) {
  const [rank, setRank] = useState(value ?? 0);
  const [pending, start] = useTransition();

  function set(e: React.MouseEvent, n: number) {
    // Used inside clickable grid rows — never let a star click navigate the row.
    e.stopPropagation();
    if (n === rank || pending) return;
    const prev = rank;
    setRank(n); // optimistic
    start(async () => {
      const res = await setPriorityRank(ticketId, n);
      if (!res.ok) setRank(prev); // revert on failure
    });
  }

  return (
    <span className={cn('st-starbtns', compact && 'compact')} role="group" aria-label={`Priority rank ${rank} of ${QUEUE_RANK_MAX}`}
      style={pending ? { opacity: 0.6 } : undefined}>
      {STARS.map((n) => (
        <button key={n} type="button" className={cn('st-starbtn', n <= rank && 'on')}
          onClick={(e) => set(e, n)} aria-label={`Set priority rank to ${n}`} aria-pressed={n <= rank}>
          ★
        </button>
      ))}
    </span>
  );
}
