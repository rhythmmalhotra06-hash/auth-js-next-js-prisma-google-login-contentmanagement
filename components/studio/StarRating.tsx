'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { setPriorityRank } from '@/app/studio/actions';

/** Editable 1–5 priority rank — writes the 2-way-synced "Priority ranking (Manual)" field. */
export function StarRating({ ticketId, value }: { ticketId: string; value: number | null }) {
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
    <span className="st-starbtns" role="group" aria-label={`Priority rank ${rank} of 5`}
      style={pending ? { opacity: 0.6 } : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={cn('st-starbtn', n <= rank && 'on')}
          onClick={(e) => set(e, n)} aria-label={`Set priority rank to ${n}`} aria-pressed={n <= rank}>
          ★
        </button>
      ))}
    </span>
  );
}
