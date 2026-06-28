'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NavItem } from '@/lib/roles';

const NOTE: Record<string, string> = {
  '/studio': 'Founder overview — what’s in production, what’s waiting on you, and what just shipped.',
  '/manager': 'Prioritize: an algorithm ranks the queue, gold rows flag what needs an editor, two status axes never merge.',
  '/editor': 'Your queue — the top item is up next; open the brief, then upload the asset.',
  '/stakeholder': 'Read-only “Shares” — who made each asset and where it shipped. No paid seat.',
  '/media': 'Clip engine — long-form talks become a ranked clip strategy you convert into tickets.',
  '/performance': 'Insights — role-aware. Live performance metrics arrive in a later phase.',
  '/settings/clip-rules': 'Tune how clips are generated — base prompt, brand pillars, rules.',
  '/settings/team': 'Admin — assign app roles to people.',
};

// Guided tour — walks ONLY the current user's accessible nav routes (no role switching).
export function Tour({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [i, setI] = useState<number | null>(null);
  const steps = nav.filter((n) => NOTE[n.href]);

  function go(idx: number) {
    if (idx < 0 || idx >= steps.length) { setI(null); return; }
    setI(idx);
    router.push(steps[idx].href);
  }

  // Launched from the sidebar's "Guided tour" nav item (no floating button).
  useEffect(() => {
    const start = () => go(0);
    window.addEventListener('portal:tour', start);
    return () => window.removeEventListener('portal:tour', start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  if (i === null) return null;

  const s = steps[i];
  return (
    <div className="tour">
      <div className="step">Guided tour</div>
      <h4>{i + 1} · {s.label}</h4>
      <p>{NOTE[s.href]}</p>
      <div className="row">
        <button className="btn ghost" onClick={() => setI(null)}>End</button>
        {i > 0 && <button className="btn ghost" onClick={() => go(i - 1)}>Back</button>}
        <button className="btn" onClick={() => go(i + 1)}>{i < steps.length - 1 ? 'Next ▸' : 'Finish'}</button>
        <span className="prog">{i + 1} / {steps.length}</span>
      </div>
    </div>
  );
}
