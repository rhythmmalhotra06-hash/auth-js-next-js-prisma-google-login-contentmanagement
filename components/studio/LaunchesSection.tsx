'use client';

import { useMemo, useState } from 'react';
import { LaunchCard } from './LaunchCard';
import type { Launch } from '@/lib/studio/data';

// Filterable launches list. Type to narrow to the launches you care about;
// empty filter shows the first few so the section stays compact.
export function LaunchesSection({ launches, previewCount = 4 }: { launches: Launch[]; previewCount?: number }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () => (needle ? launches.filter((l) => l.event.toLowerCase().includes(needle)) : launches.slice(0, previewCount)),
    [launches, needle, previewCount],
  );

  return (
    <>
      <div className="st-launchfilter">
        <input className="qsearch" placeholder="Filter launches…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter launches" />
        {needle && <span className="subtle" style={{ fontSize: 12 }}>{shown.length} of {launches.length}</span>}
      </div>
      {shown.length === 0
        ? <div className="empty">No launches match “{q}”.</div>
        : shown.map((l) => <LaunchCard key={l.slug} launch={l} />)}
    </>
  );
}
