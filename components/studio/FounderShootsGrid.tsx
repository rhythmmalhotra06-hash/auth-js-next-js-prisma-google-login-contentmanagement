import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { shortStatus, SHOOT_STATUS_TONE, type ShootRow } from '@/lib/shoots/constants';
import { shortDate } from '@/lib/studio/format';

// All shoots, founder-side — cards link to the Studio shoot detail (not the team page).
export function FounderShootsGrid({ shoots }: { shoots: ShootRow[] }) {
  if (!shoots.length) return <div className="empty">No shoots yet.</div>;
  return (
    <div className="shoot-grid">
      {shoots.map((s) => {
        const meta = [s.format, s.filmingDate ? shortDate(s.filmingDate) : null, s.filmingLocation]
          .filter(Boolean).join(' · ');
        return (
          <Link key={s.id} href={`/studio/shoots/${s.id}`} className="card pad" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
            <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
              <b style={{ fontSize: 13.5 }}>{s.title ?? 'Untitled shoot'}</b>
              <Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge>
            </div>
            <div className="t-meta">{meta || 'No filming details yet'}</div>
          </Link>
        );
      })}
    </div>
  );
}
