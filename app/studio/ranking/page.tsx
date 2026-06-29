import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { PriorityRanking } from '@/components/studio/PriorityRanking';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, toRankItem } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const items = data.active.map(toRankItem);

  return (
    <AppShell title="Priority ranking" subtitle="Set the stars — your order shapes the whole queue">
      <BackLink />
      <PriorityRanking items={items} />
      <ProposeFootnote>
        <b>Your stars are the priority.</b> Each change writes to <em>Priority ranking (Manual)</em> and syncs
        both ways with Airtable instantly. Editors pull work in the order you set here.
      </ProposeFootnote>
    </AppShell>
  );
}
