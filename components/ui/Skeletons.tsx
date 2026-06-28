// Shared loading skeletons for Suspense fallbacks. Reuse the `.skel` shimmer +
// layout classes from globals.css so streamed sections match the route-level
// loading.tsx shape. Pure presentational — no client JS.

export function Skel({ height, width, style }: { height: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height, width, ...style }} />;
}

/** KPI row — N stat cards. */
export function KpiRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="kpis">
      {Array.from({ length: count }).map((_, i) => (
        <Skel key={i} height={86} />
      ))}
    </div>
  );
}

/** A generic card / panel block. */
export function CardSkeleton({ height = 160 }: { height?: number }) {
  return <Skel height={height} style={{ marginTop: 18 }} />;
}

/** A list/table block. */
export function TableSkeleton({ height = 280 }: { height?: number }) {
  return <Skel height={height} style={{ marginTop: 18 }} />;
}

/** Queue pages (editor/manager/tickets/stakeholder/studio): KPIs + table. */
export function QueueSkeleton({ kpis = 3 }: { kpis?: number }) {
  return (
    <>
      <KpiRowSkeleton count={kpis} />
      <CardSkeleton />
      <TableSkeleton />
    </>
  );
}

/** Intake form: a tall card. */
export function FormSkeleton() {
  return (
    <>
      <Skel height={22} width={220} style={{ marginBottom: 18 }} />
      <Skel height={520} />
    </>
  );
}
