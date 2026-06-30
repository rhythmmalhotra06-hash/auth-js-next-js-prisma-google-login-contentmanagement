'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { approveShoot, declineShoot } from '@/app/studio/actions';

// Founder approve / decline for a single shoot (Studio shoot detail).
export function ShootDecision({ id }: { id: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'note'>('idle');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setErr(null);
    start(async () => {
      const r = await approveShoot(id);
      if (r.ok) router.push('/studio/shoots'); else setErr(r.error ?? 'Failed');
    });
  }
  function decline() {
    setErr(null);
    start(async () => {
      const r = await declineShoot(id, note);
      if (r.ok) router.push('/studio/shoots'); else setErr(r.error ?? 'Failed');
    });
  }

  return (
    <div className="st-commit">
      <div className="st-commit-head"><Icon name="video" size={16} /><h3>Your sign-off</h3></div>
      <div className="st-commit-list">
        <div className="st-commit-row">
          <div className="title"><b>Approve this shoot to send it to filming?</b></div>
          <div className="st-rowacts">
            {mode === 'idle' ? (
              <>
                <button className="st-sendback" onClick={() => setMode('note')} disabled={pending}>Decline</button>
                <button className="st-approve" onClick={approve} disabled={pending}><Icon name="check" size={14} /> Approve</button>
              </>
            ) : (
              <>
                <button className="st-sendback" onClick={() => setMode('idle')} disabled={pending}>Cancel</button>
                <button className="st-approve" onClick={decline} disabled={pending}>Confirm decline</button>
              </>
            )}
          </div>
        </div>
      </div>
      {mode === 'note' && (
        <div className="st-noteform">
          <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: why is this not happening? Saved to the shoot's notes." />
        </div>
      )}
      {err && <div className="st-noteform" style={{ color: '#fff', fontSize: 12 }}>{err}</div>}
    </div>
  );
}
