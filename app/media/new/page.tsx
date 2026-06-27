import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { MediaLinkForm } from '@/components/media/MediaLinkForm';

export const dynamic = 'force-dynamic';

export default function NewMediaPage() {
  return (
    <AppShell
      title="Submit a Vishen media link"
      subtitle="Drop a YouTube link to a new podcast or interview featuring Vishen. It lands in the inbox; click “Suggest clips” there to run the engine."
    >
      <Link href="/media" className="text-sm text-brand hover:underline">← Inbox</Link>
      <div className="mt-3 max-w-2xl">
        <MediaLinkForm />
      </div>
    </AppShell>
  );
}
