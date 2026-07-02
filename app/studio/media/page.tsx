import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadVishenVideos } from '@/lib/studio/data';
import { VishenMediaBoard } from '@/components/studio/VishenMediaBoard';

export const dynamic = 'force-dynamic';

export default async function VishenMediaPage() {
  await requireStudioAccess();
  const videos = await loadVishenVideos();

  return (
    <AppShell title="Your media" subtitle="Everything made for your channels — who made it, what's live, and what needs you">
      <BackLink />
      {videos.length === 0 ? (
        <div className="empty">No videos found in your content base yet.</div>
      ) : (
        <VishenMediaBoard videos={videos} />
      )}
    </AppShell>
  );
}
