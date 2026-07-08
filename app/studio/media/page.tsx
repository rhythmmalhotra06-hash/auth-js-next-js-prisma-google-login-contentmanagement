import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadVishenVideos } from '@/lib/studio/data';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { MediaHub } from '@/components/studio/media/MediaHub';

export const dynamic = 'force-dynamic';

export default async function VishenMediaPage() {
  await requireStudioAccess();

  const [videos, proposedRes, approvedRes, mediaRes] = await Promise.all([
    loadVishenVideos(),
    listClipsByStatus('Proposed'),
    listClipsByStatus('Approved'),
    listMediaSources(100),
  ]);

  const sources = mediaRes.ok ? mediaRes.data : [];
  const sourceNames: Record<string, string> = {};
  for (const s of sources) if (s.title) sourceNames[s.id] = s.title;

  return (
    <AppShell title="Your media" subtitle="Everything made for your channels — catch up, approve, and see what's coming">
      <BackLink />
      {videos.length === 0 ? (
        <div className="empty">No videos found in your content base yet.</div>
      ) : (
        <MediaHub
          videos={videos}
          proposedClips={proposedRes.ok ? proposedRes.data : []}
          approvedClips={approvedRes.ok ? approvedRes.data : []}
          sourceNames={sourceNames}
        />
      )}
    </AppShell>
  );
}
