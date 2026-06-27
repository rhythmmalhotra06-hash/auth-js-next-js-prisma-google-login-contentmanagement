import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { guardRoute } from '@/lib/auth/route-guard';
import { getEmployeeForSession } from '@/lib/employee';

export const dynamic = 'force-dynamic';

// Statuses a stakeholder sees in the main board: work that's in flight or finished —
// in progress / in review / approved / published / done. Early intake stages
// (Requested, Prioritized, Assigned) and Won't Do are hidden. Matched case-insensitively
// so it tolerates the base's exact enum spelling (In Production vs In Progress, etc.).
const STAKEHOLDER_VISIBLE = new Set([
  'in progress',
  'in production',
  'in review',
  'review',
  'in revision',
  'approved',
  'published',
  'done',
]);
const stakeholderVisible = (s: string | null) => !!s && STAKEHOLDER_VISIBLE.has(s.trim().toLowerCase());

// Read-only view — the free, unlimited stakeholder/agency surface (Ziflow pattern).
// Distribution links + live performance metrics arrive with the Performance Loop (E7).
export default async function StakeholderPage() {
  await guardRoute('/stakeholder');

  const [allTickets, employee] = await Promise.all([
    getQueueTickets({ includeCompleted: true }),
    getEmployeeForSession(),
  ]);

  const visible = allTickets.filter((t) => stakeholderVisible(t.ticketStatus));
  // "My requests": everything this person raised, at any stage (matched by their
  // Google email → Employees record → requester link on the ticket).
  const mine = employee ? allTickets.filter((t) => t.requesterId === employee.id) : [];

  return (
    <AppShell
      title="Stakeholder — Status"
      subtitle={`Read-only · in progress, review, approved & published work · ${visible.length} item${visible.length === 1 ? '' : 's'}`}
    >
      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-text">
            Requests you raised <span className="font-normal text-text-muted">· {mine.length}</span>
          </h2>
          <QueueTable tickets={mine} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">All work — in progress → done</h2>
        <QueueTable tickets={visible} />
      </section>
    </AppShell>
  );
}
