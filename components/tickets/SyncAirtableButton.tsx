'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { syncToAirtableNow } from '@/app/manager/actions';

// Manual "Sync to Airtable now" — flushes the push outbox (portal → Airtable).
// The scheduled drain is IAP-blocked, so this is the interim trigger.
export function SyncAirtableButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <button
      onClick={() =>
        start(async () => {
          const r = await syncToAirtableNow();
          if (!r.ok) setMsg(r.error ?? 'failed');
          else if (!r.enabled) setMsg('push disabled');
          else setMsg(`↑${r.created} ⟳${r.updated}${r.failed ? ` ✕${r.failed}` : ''}`);
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      title="Push queued ticket changes to Airtable"
    >
      {pending ? 'Syncing…' : `Sync to Airtable${msg ? ` · ${msg}` : ''}`}
    </button>
  );
}
