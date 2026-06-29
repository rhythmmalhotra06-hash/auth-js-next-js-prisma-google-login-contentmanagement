import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

const cardCls =
  'card pad group flex flex-col rounded-[16px] border border-border-default bg-surface no-underline transition-shadow hover:shadow-[var(--mv-shadow-light)]';

export default function NewRequestPage() {
  return (
    <AppShell title="New request" subtitle="Pick what you need — we route it to the right team automatically.">
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link href="/intake/creative" className={cardCls}>
          <div className="thumb" style={{ width: 42, height: 42 }}><Icon name="sparkle" size={22} /></div>
          <h3 style={{ fontSize: 16, margin: '12px 0 6px' }}>Creative request</h3>
          <p className="text-sm text-text-muted" style={{ lineHeight: 1.5 }}>
            An edit or design job for an existing asset — trailer, reel, banner, VSSL. Routed by event &amp; asset type.
          </p>
          <span className="btn sm primary" style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <Icon name="arrow" size={14} /> Start creative request
          </span>
        </Link>

        <Link href="/shoots/new" className={cardCls}>
          <div className="thumb" style={{ width: 42, height: 42 }}><Icon name="video" size={22} /></div>
          <h3 style={{ fontSize: 16, margin: '12px 0 6px' }}>Shoot request</h3>
          <p className="text-sm text-text-muted" style={{ lineHeight: 1.5 }}>
            You want to film or shoot something — studio, VLOG, interview, b-roll. Goes to the studio queue for scheduling.
          </p>
          <span className="btn sm primary" style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <Icon name="arrow" size={14} /> Start shoot request
          </span>
        </Link>
      </div>
    </AppShell>
  );
}
