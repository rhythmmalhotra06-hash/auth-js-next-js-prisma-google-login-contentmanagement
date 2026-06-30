import { cn } from '@/lib/cn';

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="kpis">{children}</div>;
}

export function Kpi({ label, value, sub, tone, icon, i }: {
  label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode;
  tone?: 'alert' | 'danger' | 'attention'; icon?: React.ReactNode; i?: number;
}) {
  return (
    <div className={cn('kpi', tone === 'alert' && 'alert', tone === 'danger' && 'danger', tone === 'attention' && 'attention')}
      style={i != null ? ({ ['--i' as string]: i }) : undefined}>
      <div className="lab">{icon}{label}</div>
      <div className="val">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  );
}
