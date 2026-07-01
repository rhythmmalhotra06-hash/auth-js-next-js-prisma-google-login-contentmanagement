import { cn } from '@/lib/cn';

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="kpis">{children}</div>;
}

export function Kpi({ label, value, sub, tone, icon, i, onClick, active }: {
  label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode;
  tone?: 'alert' | 'danger' | 'attention'; icon?: React.ReactNode; i?: number;
  onClick?: () => void; active?: boolean;
}) {
  const className = cn('kpi', tone === 'alert' && 'alert', tone === 'danger' && 'danger', tone === 'attention' && 'attention',
    onClick && 'clickable', active && 'on');
  const style = i != null ? ({ ['--i' as string]: i }) : undefined;
  const inner = (
    <>
      <div className="lab">{icon}{label}</div>
      <div className="val">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </>
  );
  // A clickable KPI is a real button (keyboard-operable, pressed state); otherwise a plain card.
  return onClick
    ? <button type="button" className={className} style={style} onClick={onClick} aria-pressed={!!active}>{inner}</button>
    : <div className={className} style={style}>{inner}</div>;
}
