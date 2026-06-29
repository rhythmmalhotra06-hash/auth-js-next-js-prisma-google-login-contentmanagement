import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  await requireStudioAccess();
  const data = await loadStudio();

  return (
    <AppShell title="Priority ranking" subtitle="Set the stars — your order shapes the whole queue">
      <BackLink />
      <QueueTable tickets={data.active} basePath="/tickets" storageKey="studio-ranking" scoringConfig={data.scoringConfig} editableRank />
      <ProposeFootnote>
        <b>Your stars are the priority.</b> Each change writes to <em>Priority ranking (Manual)</em> and syncs
        both ways with Airtable instantly. Editors pull work in the order you set here.
      </ProposeFootnote>
    </AppShell>
  );
}
