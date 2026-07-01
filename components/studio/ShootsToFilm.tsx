import Link from 'next/link';
import { shortDate } from '@/lib/studio/format';
import type { ShootSignOffItem } from '@/lib/studio/data';

/**
 * Fallback shoots box for the sign-off zone: shown when nothing needs Vishen's review.
 * Read-only — the next shoots lined up to film, so the zone always has a shoots box.
 */
export function ShootsToFilm({ items }: { items: ShootSignOffItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="st-commit">
      <div className="st-commit-head">
        <div className="lhs">
          <span aria-hidden>🎬</span>
          <h3>Shoots to film</h3>
          <span className="cnt">{items.length}</span>
        </div>
      </div>
      <div className="st-commit-list">
        {items.slice(0, 5).map((it) => {
          const meta = [it.format, it.filmingDate ? shortDate(it.filmingDate) : null, it.filmingLocation]
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={it.id} className="st-commit-row">
              <div className="title">
                <Link href={`/studio/shoots/${it.id}`} style={{ color: 'inherit' }}><b>{it.title}</b></Link>
                <div className="meta">{meta || 'No filming details yet'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
