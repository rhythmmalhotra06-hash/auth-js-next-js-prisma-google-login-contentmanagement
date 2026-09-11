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

/**
 * The Monday pack (/performance/week): two brand cards, a briefing, two number cards, the day
 * table, a post grid. Mirrors the section rhythm of the real page so the swap does not jump.
 */
export function WeekPackSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid gap-3 md:grid-cols-2">
        <Skel height={132} />
        <Skel height={132} />
      </div>
      <Skel height={96} />
      <div className="grid gap-3 md:grid-cols-2">
        <Skel height={168} />
        <Skel height={168} />
      </div>
      <Skel height={300} />
      <Skel height={220} />
    </div>
  );
}

/** The comms calendar (/studio/comms-calendar): pager row, then the grid. */
export function CalendarSkeleton({ view = 'week' }: { view?: 'week' | 'month' }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <Skel height={32} width={180} />
      <Skel height={view === 'month' ? 560 : 420} />
    </div>
  );
}
