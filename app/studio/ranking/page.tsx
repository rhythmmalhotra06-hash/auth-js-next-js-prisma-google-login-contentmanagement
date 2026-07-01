import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

// The ranking board is about work not yet in production — prioritise the
// Backlog and To Do queue. Everything else (In Progress, Review, Request on
// Hold, Done…) is out of scope here, so it never reaches the table.
const RANKABLE = new Set(['Backlog', 'To Do']);

export default async function RankingPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const rankable = data.active.filter((t) => RANKABLE.has(t.ticketStatus ?? ''));

  return (
    <AppShell title="Priority ranking" subtitle="Set the stars — your order shapes the whole queue">
      <BackLink />
      <QueueTable tickets={rankable} basePath="/tickets" storageKey="studio-ranking" scoringConfig={data.scoringConfig} editableRank />
      <ProposeFootnote>
        <b>Your stars are the priority.</b> Each change writes to <em>Priority ranking (Manual)</em> and syncs
        both ways with Airtable instantly. Editors pull work in the order you set here.
      </ProposeFootnote>
    </AppShell>
  );
}
