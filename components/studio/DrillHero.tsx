import { TierBadge } from '@/components/ui/TierBadge';
import type { Launch } from '@/lib/studio/data';
import { shortDate } from '@/lib/studio/format';
import { Meter } from '@/components/studio/Meter';

/** Launch drill-down hero: the event's status breakdown + meter. */
export function DrillHero({ launch }: { launch: Launch }) {
  const due = shortDate(launch.due);
  return (
    <div className="st-drill-hero">
      <TierBadge event={launch.event} />
      <h2>{launch.event}</h2>
      <div className="st-nums">
        <div className="st-num"><div className="v">{launch.total}</div><div className="k">assets</div></div>
        <div className="st-num"><div className="v" style={{ color: 'var(--green-content)' }}>{launch.ship}</div><div className="k">shipped</div></div>
        <div className="st-num"><div className="v" style={{ color: 'var(--st-violet)' }}>{launch.rev}</div><div className="k">in review</div></div>
        <div className="st-num"><div className="v" style={{ color: 'var(--amber-content)' }}>{launch.prod}</div><div className="k">in production</div></div>
        <div className="st-num"><div className="v" style={{ color: 'var(--text-subtle)' }}>{launch.todo}</div><div className="k">to do</div></div>
        {due && <div className="st-num"><div className="v">{due}</div><div className="k">next due</div></div>}
      </div>
      <Meter ship={launch.ship} rev={launch.rev} prod={launch.prod} todo={launch.todo} />
    </div>
  );
}
