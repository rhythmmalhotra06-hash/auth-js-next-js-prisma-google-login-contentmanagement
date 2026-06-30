import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { requireSocialAccess } from '@/lib/social/guard';
import { SocialLinkForm } from '@/components/social/SocialLinkForm';

export const dynamic = 'force-dynamic';

export default async function NewSocialPage() {
  await requireSocialAccess();
  return (
    <AppShell
      title="Generate social clips"
      subtitle="Drop a media link — we transcribe it and draft ranked clip suggestions. They land as proposals; nothing becomes a ticket until you raise it."
    >
      <Link href="/social" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Suggestions</Link>
      <div className="max-w-2xl">
        <SocialLinkForm />
      </div>
    </AppShell>
  );
}
