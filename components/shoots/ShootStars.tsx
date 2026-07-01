'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { SHOOT_RANK_MAX } from '@/lib/shoots/constants';
import { setShootRank } from '@/app/shoots/actions';

/**
 * Editable manual priority rank for a shoot — writes the "Priority Ranking (Manual)"
 * star field (max 10). Clicking the current value clears it back to 0.
 */
export function ShootStars({ shootId, value }: { shootId: string; value: number | null }) {
  const [rank, setRank] = useState(value ?? 0);
  const [pending, start] = useTransition();

  function set(n: number) {
    if (pending) return;
    const next = n === rank ? 0 : n; // click the current star to clear
    const prev = rank;
    setRank(next); // optimistic
    start(async () => {
      const res = await setShootRank(shootId, next);
      if (!res.ok) setRank(prev); // revert on failure
    });
  }

  return (
    <span className="st-starbtns" role="group" aria-label={`Priority rank ${rank} of ${SHOOT_RANK_MAX}`}
      style={pending ? { opacity: 0.6 } : undefined}>
      {Array.from({ length: SHOOT_RANK_MAX }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className={cn('st-starbtn', n <= rank && 'on')}
          onClick={() => set(n)} aria-label={`Set priority rank to ${n}`} aria-pressed={n <= rank}>
          ★
        </button>
      ))}
    </span>
  );
}
