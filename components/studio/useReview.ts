'use client';

import { useState, useTransition } from 'react';
import { approveReview, sendBackForRevision } from '@/app/studio/actions';

/** Shared review-row behaviour for the sign-off hero + the full review table. */
export function useReview(ticketId: string, onDone: () => void) {
  const [mode, setMode] = useState<'idle' | 'note'>('idle');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setErr(null);
    start(async () => {
      const res = await approveReview(ticketId);
      if (res.ok) onDone();
      else setErr(res.error ?? 'Failed');
    });
  }

  function sendBack() {
    if (!note.trim()) {
      setErr('Add a note before sending back');
      return;
    }
    setErr(null);
    start(async () => {
      const res = await sendBackForRevision(ticketId, note);
      if (res.ok) onDone();
      else setErr(res.error ?? 'Failed');
    });
  }

  return { mode, setMode, note, setNote, err, pending, approve, sendBack };
}
