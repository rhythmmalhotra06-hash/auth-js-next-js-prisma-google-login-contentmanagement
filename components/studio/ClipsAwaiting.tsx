import Link from 'next/link';
import type { ClipSuggestion } from '@/lib/media/repository';

/**
 * "Clips awaiting you" — proposed AI clips pending Vishen's approval, top virality first.
 * White card beneath the purple Shoots box in the sign-off zone (studio-redesign mockup).
 * Each clip links to its media source, where it can be reviewed / approved.
 */
export function ClipsAwaiting({ clips, total }: { clips: ClipSuggestion[]; total: number }) {
  if (clips.length === 0) return null;

  return (
    <div className="card pad">
      <div className="eyebrow st-awaithead">✦ Clips awaiting you · {total}</div>
      {clips.map((c) => (
        <div key={c.id} className="st-awaitline">
          <span className="st-awaitvir">{c.viralityScore ?? '—'}</span>
          <span className="txt">{c.hookLine || c.name || 'Untitled clip'}</span>
          {c.mediaSourceId
            ? <Link href={`/media/${c.mediaSourceId}`} className="btn sm primary">Review</Link>
            : <span className="btn sm" aria-disabled>Review</span>}
        </div>
      ))}
    </div>
  );
}
