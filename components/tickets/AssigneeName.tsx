// The credited creative. 👬 Employees is synced from HR, so an offboarded person's row is
// deleted and the Airtable link blanks — attribution now comes from `tickets.assignee_name`
// (see prisma/migrations/0019_ticket_assignee_name), which outlives the FK. When the person
// is off the roster we still show their name and mark it, rather than dropping the credit.

export function AssigneeName({ name, exTeam }: { name: string | null; exTeam?: boolean }) {
  if (!name) return <span className="subtle">Unassigned</span>;
  if (!exTeam) return <>{name}</>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {name}
      <span className="text-2xs text-text-subtle" title="No longer on the roster — kept for attribution">ex-team</span>
    </span>
  );
}
