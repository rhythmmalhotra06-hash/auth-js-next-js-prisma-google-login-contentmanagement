'use client';

// The commit bar — the pack's ONE gold element.
//
// Gold is attention-only on this project, and "if two things are gold, neither reads as urgent".
// So it belongs to exactly one thing per screen, and on the pack that thing is the commit: it is
// the only action that changes the record, and the only reason the meeting needs the page open.
//
// It says what is uncommitted rather than just offering a button, because "Commit" on its own does
// not tell the room what they are agreeing to. And when the viewer may NOT commit it does not
// vanish — it says who can (S4: Gareth, Glen or Ramya). A hidden control is indistinguishable
// from a broken one.

import { useState, useTransition } from 'react';
import { commitWeekAction, reopenWeekAction } from '@/app/performance/week/actions';
import { cn } from '@/lib/cn';

export interface CommitTarget {
  weekId: string;
  brand: string;
  label: string;
  committed: boolean;
  committedBy: string | null;
  /** What is still staged on this brand-week, in plain words. */
  pending: string[];
}

export function CommitBar({ targets, canCommit }: { targets: CommitTarget[]; canCommit: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!targets.length) return null;

  const uncommitted = targets.filter((t) => !t.committed);
  const allCommitted = uncommitted.length === 0;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Could not save.');
    });
  };

  return (
    <div
      className={cn(
        'rounded-md border-2 px-4 py-3.5',
        // Committed is not an alarm. The gold retires once there is nothing to decide.
        allCommitted ? 'border-border-strong bg-surface' : 'border-gold bg-surface',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          {allCommitted ? (
            <>
              <div className="text-[13.5px] font-semibold">This week is committed</div>
              <div className="mt-0.5 text-xs text-text-muted">
                {targets
                  .map((t) => `${t.label} by ${t.committedBy?.split('@')[0] ?? 'someone'}`)
                  .join(' · ')}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold text-gold-content">
                {uncommitted.length === targets.length
                  ? 'Nothing is committed yet'
                  : `${uncommitted.map((t) => t.label).join(' and ')} still uncommitted`}
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                {uncommitted.some((t) => t.pending.length)
                  ? `Staged: ${[...new Set(uncommitted.flatMap((t) => t.pending))].join(', ')}. Committing snapshots them — a later ingest cannot change what the room agreed.`
                  : 'Nothing is staged yet, so there is nothing to snapshot.'}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-none flex-wrap items-center gap-2">
          {targets.map((t) =>
            t.committed ? (
              <button
                key={t.weekId}
                type="button"
                disabled={!canCommit || pending}
                onClick={() => run(() => reopenWeekAction(t.weekId))}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-2xs font-semibold text-text-muted hover:bg-bg-subtle disabled:opacity-50"
              >
                Reopen {t.label}
              </button>
            ) : (
              <button
                key={t.weekId}
                type="button"
                disabled={!canCommit || pending}
                onClick={() => run(() => commitWeekAction(t.weekId))}
                className="rounded-sm bg-gold px-3.5 py-2 text-2xs font-bold text-gold-content hover:opacity-90 disabled:opacity-50"
              >
                Commit {t.label}
              </button>
            ),
          )}
        </div>
      </div>

      {!canCommit ? (
        // Never a hidden button. The room should know who can unblock this.
        <div className="mt-2.5 border-t border-border-default pt-2.5 text-xs text-text-muted">
          You can read this pack but not commit it. Gareth, Glen or Ramya can.
        </div>
      ) : null}

      {error ? (
        <div className="mt-2.5 border-t border-border-default pt-2.5 text-xs text-danger-content">{error}</div>
      ) : null}
    </div>
  );
}
