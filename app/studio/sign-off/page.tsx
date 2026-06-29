import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { ReviewQueueTable } from '@/components/studio/ReviewQueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getReviewQueue, toReviewItem } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function SignOffPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const items = getReviewQueue(data.active).map(toReviewItem);

  return (
    <AppShell title="Sign-off queue" subtitle="The team's priority proposal — you confirm">
      <BackLink />
      <ReviewQueueTable items={items} />
      <ProposeFootnote>
        <b>This is the team&apos;s priority proposal.</b> Managers set a ranking; you confirm or push back.
        Approving moves it into the queue, and sending back saves your note to V&apos;s Notes — editors only
        ever pick up what you&apos;ve signed off.
      </ProposeFootnote>
    </AppShell>
  );
}
