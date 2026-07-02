'use client';

import { useState, useTransition } from 'react';
import { runReferenceSync, runBackfill, runPush, runPull, type SyncActionResult } from '@/app/admin/sync/actions';

// Admin-only manual sync controls. Each button runs the same operation a Kessel cron
// will run on a schedule — handy for the initial cutover backfill and for testing.
export function SyncControls() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SyncActionResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const run = (label: string, fn: () => Promise<SyncActionResult>) => {
    setRunning(label);
    setResult(null);
    start(async () => {
      const r = await fn();
      setResult(r);
      setRunning(null);
    });
  };

  return (
    <div className="card pad" style={{ marginBottom: 16 }}>
      <div className="font-display text-lg" style={{ marginBottom: 8 }}>Manual sync</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn sm" disabled={pending} onClick={() => run('reference', runReferenceSync)}>
          {running === 'reference' ? 'Syncing…' : 'Sync reference'}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run('backfill', () => runBackfill(false))}>
          {running === 'backfill' ? 'Backfilling…' : 'Backfill active tickets'}
        </button>
        <button className="btn ghost sm" disabled={pending} onClick={() => run('backfill-all', () => runBackfill(true))}>
          {running === 'backfill-all' ? 'Backfilling all…' : 'Backfill ALL history (slow)'}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run('push', runPush)}>
          {running === 'push' ? 'Pushing…' : 'Push → Airtable'}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run('pull', runPull)}>
          {running === 'pull' ? 'Pulling…' : 'Pull ← Airtable'}
        </button>
      </div>
      {result && (
        <div className={`text-sm ${result.ok ? 'text-text' : 'text-brand'}`} style={{ marginTop: 10 }}>
          {result.ok ? '✓ ' : '✗ '}{result.message}
        </div>
      )}
    </div>
  );
}
