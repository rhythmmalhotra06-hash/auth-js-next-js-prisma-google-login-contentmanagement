import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { RiskItem } from '@/lib/studio/data';

/** Red at-risk block — founder-decision items only. Used on the landing (sliced) and the full view. */
export function AtRiskBlock({ items, limit }: { items: RiskItem[]; limit?: number }) {
  if (items.length === 0) {
    return (
      <div className="st-signoff-clear">
        <div className="badge"><Icon name="check" size={20} /></div>
        <div>
          <h3>Nothing needs a call from you</h3>
          <p>No orphaned shoots, untagged work, or overdue items right now.</p>
        </div>
      </div>
    );
  }
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="st-risk">
      <div className="st-risk-head">
        <Icon name="bolt" size={18} />
        <h3>{items.length} {items.length === 1 ? 'thing' : 'things'} at risk</h3>
      </div>
      {shown.map((r) => (
        <div className="st-risk-row" key={`${r.kind}-${r.id}`}>
          <Icon name={r.icon as IconName} size={17} className="ic" />
          <span className="txt">{r.text}</span>
          <span className="age">{r.age}</span>
          <Link href={r.href} className="st-fix">{r.fixLabel}</Link>
        </div>
      ))}
    </div>
  );
}
