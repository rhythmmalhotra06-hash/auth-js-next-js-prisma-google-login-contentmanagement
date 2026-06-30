'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { shortStatus, SHOOT_STATUS_TONE, type ShootRow } from '@/lib/shoots/constants';
import { shortDate } from '@/lib/studio/format';
import { FounderShootsGrid } from './FounderShootsGrid';

// All shoots, founder-side, with a Cards / Grid view toggle.
export function FounderShoots({ shoots }: { shoots: ShootRow[] }) {
  const [view, setView] = useState<'cards' | 'grid'>('cards');
  return (
    <>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="subtle" style={{ fontSize: 12 }}>{shoots.length} shoot{shoots.length === 1 ? '' : 's'}</span>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} aria-pressed={view === 'cards'}>Cards</button>
          <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'}>Grid</button>
        </div>
      </div>
      {view === 'cards' ? <FounderShootsGrid shoots={shoots} /> : <ShootGrid shoots={shoots} />}
    </>
  );
}

function ShootGrid({ shoots }: { shoots: ShootRow[] }) {
  const router = useRouter();
  if (!shoots.length) return <div className="empty">No shoots yet.</div>;
  return (
    <div className="tw">
      <div className="tscroll">
        <table className="list">
          <thead>
            <tr><th>Title</th><th>Status</th><th>Format</th><th>Filming date</th><th>Location</th><th>Tickets</th></tr>
          </thead>
          <tbody>
            {shoots.map((s) => (
              <tr key={s.id} onClick={() => router.push(`/studio/shoots/${s.id}`)}>
                <td className="t-title">{s.title ?? 'Untitled shoot'}</td>
                <td><Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge></td>
                <td>{s.format ?? '—'}</td>
                <td>{s.filmingDate ? shortDate(s.filmingDate) : <span className="subtle">—</span>}</td>
                <td>{s.filmingLocation ?? <span className="subtle">—</span>}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.ticketCount || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
