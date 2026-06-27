'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { repairSchema } from '@/lib/admin/db-repair';

export function RepairButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        onClick={() =>
          start(async () => {
            const r = await repairSchema();
            setMsg(
              r.ok
                ? `✓ Repair applied ${r.applied} statements, 0 failures`
                : `Applied ${r.applied}; ${r.failures.length} failed: ${r.failures.map((f) => f.error).join(' | ')}`,
            );
            router.refresh();
          })
        }
        disabled={pending}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: '#572280' }}
      >
        {pending ? 'Repairing…' : 'Run schema repair'}
      </button>
      {msg && <p className="text-sm text-neutral-700">{msg}</p>}
    </div>
  );
}
