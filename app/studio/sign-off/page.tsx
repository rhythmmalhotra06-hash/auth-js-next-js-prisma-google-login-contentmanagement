import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ContentReviewQueue } from '@/components/studio/ContentReviewQueue';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getContentReviewQueue } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const items = getContentReviewQueue(data.active);

  return (
    <AppShell title="Review queue" subtitle="Work in review and in revision, grouped by status">
      <BackLink />
      <ContentReviewQueue items={items} />
    </AppShell>
  );
}
