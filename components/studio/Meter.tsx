// Launch status meter (shipped / review / production / to-do) + its legend.

interface Buckets {
  ship: number;
  rev: number;
  prod: number;
  todo: number;
}

export function Meter({ ship, rev, prod, todo }: Buckets) {
  const total = ship + rev + prod + todo || 1;
  const w = (n: number) => ({ width: `${((n / total) * 100).toFixed(1)}%` });
  return (
    <div className="st-meter" aria-hidden="true">
      <span className="st-ship" style={w(ship)} />
      <span className="st-rev" style={w(rev)} />
      <span className="st-prod" style={w(prod)} />
      <span className="st-todo" style={w(todo)} />
    </div>
  );
}

export function MeterLegend({ ship, rev, prod, todo }: Buckets) {
  return (
    <div className="st-legend">
      <span><i className="dot" style={{ background: 'var(--green)' }} />{ship} shipped</span>
      <span><i className="dot" style={{ background: 'var(--st-violet)' }} />{rev} in review</span>
      <span><i className="dot" style={{ background: 'var(--st-violet-soft)' }} />{prod} in production</span>
      <span><i className="dot" style={{ background: 'var(--border-strong)' }} />{todo} to do</span>
    </div>
  );
}
