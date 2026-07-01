import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { requireSocialAccess } from '@/lib/social/guard';
import { SocialLinkForm } from '@/components/social/SocialLinkForm';
import { listCommsCalendarEntries } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export default async function NewSocialPage() {
  await requireSocialAccess();
  const calRes = await listCommsCalendarEntries();
  const calendars = calRes.ok ? calRes.data : [];
  return (
    <AppShell
      title="Generate social clips"
      subtitle="Drop a media link — we transcribe it and draft ranked clip suggestions. They land as proposals; nothing becomes a ticket until you raise it."
    >
      <Link href="/social" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Suggestions</Link>
      <div className="max-w-2xl">
        <SocialLinkForm calendars={calendars} />
      </div>
    </AppShell>
  );
}
