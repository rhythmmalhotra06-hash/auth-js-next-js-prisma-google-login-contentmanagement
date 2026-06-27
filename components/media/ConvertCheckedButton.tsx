'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { convertCheckedClips } from '@/app/media/actions';

/**
 * Manual trigger for the Airtable checkbox → ticket flow. Runs the same
 * convertCheckedClips() the hourly cron uses, so the team doesn't have to wait
 * for the next poll after ticking "Create Ticket" on a clip.
 */
export function ConvertCheckedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await convertCheckedClips();
      if (res.error) {
        setMsg({ kind: 'err', text: res.error });
        return;
      }
      const parts = [`${res.created} ticket${res.created === 1 ? '' : 's'} created`];
      if (res.failed.length) parts.push(`${res.failed.length} skipped`);
      if (res.scanned === 0) parts[0] = 'No clips are ticked “Create Ticket”';
      setMsg({
        kind: res.failed.length ? 'err' : 'ok',
        text: res.failed.length
          ? `${parts.join(', ')}. ${res.failed[0].error}`
          : parts.join(', ') + '.',
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className="shrink-0 rounded-[8px] px-4 py-2.5 text-sm font-medium text-brand ring-1 ring-brand/30 hover:bg-brand/5 disabled:opacity-50"
      >
        {pending ? 'Converting…' : 'Convert checked now'}
      </button>
      {msg && (
        <span className={`text-xs ${msg.kind === 'ok' ? 'text-success-content' : 'text-amber-600'}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
