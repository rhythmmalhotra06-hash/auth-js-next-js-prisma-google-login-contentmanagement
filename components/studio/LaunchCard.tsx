import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { Launch } from '@/lib/studio/data';
import { shortDate } from '@/lib/studio/format';
import { Meter, MeterLegend } from '@/components/studio/Meter';

/** A launch (event) card with status meter — links to the asset-by-asset drill. */
export function LaunchCard({ launch }: { launch: Launch }) {
  const due = shortDate(launch.due);
  return (
    <Link href={`/studio/launches/${launch.slug}`} className="st-launch">
      <div className="st-launch-top">
        <span className="st-launch-name">{launch.event}</span>
        <span className="st-launch-cnt">
          {launch.total} {launch.total === 1 ? 'asset' : 'assets'}{due ? ` · due ${due}` : ''}
          <Icon name="arrow" size={14} />
        </span>
      </div>
      <Meter ship={launch.ship} rev={launch.rev} prod={launch.prod} todo={launch.todo} />
      <MeterLegend ship={launch.ship} rev={launch.rev} prod={launch.prod} todo={launch.todo} />
    </Link>
  );
}
