'use client';

import { useState } from 'react';
import { LaunchCard } from './LaunchCard';
import type { Launch } from '@/lib/studio/data';

// Filterable launches. Options are the live launch events (each is an event type
// with active work), so the dropdown only ever lists active launches.
export function LaunchesSection({ launches, previewCount = 4 }: { launches: Launch[]; previewCount?: number }) {
  const [sel, setSel] = useState('');
  const shown = sel ? launches.filter((l) => l.event === sel) : launches.slice(0, previewCount);

  return (
    <>
      <div className="st-launchfilter">
        <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Filter launches by event">
          <option value="">All active launches</option>
          {launches.map((l) => <option key={l.slug} value={l.event}>{l.event}</option>)}
        </select>
        {!sel && launches.length > previewCount && (
          <span className="subtle" style={{ fontSize: 12 }}>showing {previewCount} of {launches.length}</span>
        )}
      </div>
      {shown.length === 0
        ? <div className="empty">No active launches.</div>
        : shown.map((l) => <LaunchCard key={l.slug} launch={l} />)}
    </>
  );
}
