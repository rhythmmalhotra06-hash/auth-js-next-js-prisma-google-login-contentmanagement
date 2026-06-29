import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { AtRiskBlock } from '@/components/studio/AtRiskBlock';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getAtRisk } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function AtRiskPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const risk = getAtRisk(data.active, data.shoots);

  return (
    <AppShell title="At risk" subtitle="Decisions only you can make">
      <BackLink />
      <AtRiskBlock items={risk} />
      <ProposeFootnote>
        <b>These need a decision the team can&apos;t make for you.</b> A shoot with no post-production ticket,
        an untagged item the priority score can&apos;t read, or work aged past its due date. Everything else
        the team clears before it ever reaches this list.
      </ProposeFootnote>
    </AppShell>
  );
}
