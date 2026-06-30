import { cn } from '@/lib/cn';

type Trend = 'up' | 'down' | 'flat';

const TREND: Record<Trend, string> = {
  up: 'bg-success-soft text-success-content',
  down: 'bg-danger-soft text-danger-content',
  flat: 'bg-bg-subtle text-text-muted',
};

export function MetricCard({ label, value, trend, trendLabel, className }: {
  label: string; value: string | number; trend?: Trend; trendLabel?: string; className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-border-default bg-surface p-4 shadow-[var(--mv-shadow-light)]', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-3xl font-bold leading-none text-text">{value}</span>
        {trend && trendLabel && (
          <span className={cn('rounded-sm px-2 py-0.5 text-xs font-medium', TREND[trend])}>{trendLabel}</span>
        )}
      </div>
    </div>
  );
}

export function MetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)}>{children}</div>;
}
