import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets, getActiveEmployees } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { EmployeePicker } from '@/components/tickets/EmployeePicker';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { guardRoute } from '@/lib/auth/route-guard';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ assignee?: string }> }) {
  await guardRoute('/editor');
  const { assignee } = await searchParams;
  const [tickets, employees, approvedRes, sourcesRes, reference] = await Promise.all([
    getQueueTickets({ assigneeId: assignee }),
    getActiveEmployees(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
    getIntakeReferenceData(),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );
  const sourceUrls: Record<string, string> = Object.fromEntries(
    sources.filter((s) => s.sourceUrl).map((s) => [s.id, s.sourceUrl as string]),
  );

  return (
    <AppShell
      title="Editor — My Queue"
      subtitle={assignee ? `${tickets.length} assigned · next up first` : 'Pick an editor to see their assigned work'}
      actions={<EmployeePicker employees={employees} value={assignee ?? ''} />}
    >
      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} sourceUrls={sourceUrls} reference={reference} />
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
