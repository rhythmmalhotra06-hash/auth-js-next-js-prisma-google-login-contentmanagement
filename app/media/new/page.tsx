import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { MediaLinkForm } from '@/components/media/MediaLinkForm';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default function NewMediaPage() {
  return (
    <AppShell
      title="Submit a Vishen media link"
      subtitle="Drop a YouTube link to a new podcast or interview featuring Vishen. It lands in the inbox; click “Suggest clips” there to run the engine."
    >
      <Link href="/media" className="st-back">
        <Icon name="arrow" size={14} className="rotate-180" /> Inbox
      </Link>
      <div className="max-w-2xl">
        <MediaLinkForm />
      </div>
    </AppShell>
  );
}
