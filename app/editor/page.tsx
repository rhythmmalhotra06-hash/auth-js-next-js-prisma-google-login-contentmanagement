import { AppNav } from '@/components/AppNav';
import { getQueueTickets, getActiveEmployees } from '@/lib/tickets/data';
import { TicketTable } from '@/components/tickets/TicketTable';
import { EmployeePicker } from '@/components/tickets/EmployeePicker';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ assignee?: string }> }) {
  const { assignee } = await searchParams;
  const [tickets, employees] = await Promise.all([
    getQueueTickets({ assigneeId: assignee }),
    getActiveEmployees(),
  ]);

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <AppNav active="Editor" />
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Editor — My Queue</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {assignee ? `${tickets.length} assigned · next up first` : 'Pick an editor to see their assigned work (assignment lands in E4)'}
            </p>
          </div>
          <EmployeePicker employees={employees} value={assignee ?? ''} />
        </div>
        <TicketTable tickets={tickets} />
      </div>
    </main>
  );
}
