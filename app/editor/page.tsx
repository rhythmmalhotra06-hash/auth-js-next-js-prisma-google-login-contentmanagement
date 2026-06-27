import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets, getActiveEmployees } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { EmployeePicker } from '@/components/tickets/EmployeePicker';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ assignee?: string }> }) {
  const { assignee } = await searchParams;
  const [tickets, employees, approvedRes, sourcesRes] = await Promise.all([
    getQueueTickets({ assigneeId: assignee }),
    getActiveEmployees(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    (sourcesRes.ok ? sourcesRes.data : []).map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );

  return (
    <AppShell
      title="Editor — My Queue"
      subtitle={assignee ? `${tickets.length} assigned · next up first` : 'Pick an editor to see their assigned work'}
      actions={<EmployeePicker employees={employees} value={assignee ?? ''} />}
    >
      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} />
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
