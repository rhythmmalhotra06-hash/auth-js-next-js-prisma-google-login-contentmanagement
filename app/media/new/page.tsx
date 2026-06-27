import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { MediaLinkForm } from '@/components/media/MediaLinkForm';

export const dynamic = 'force-dynamic';

export default function NewMediaPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <AppNav active="Media" />
        <div className="mb-6">
          <Link href="/media" className="text-sm text-neutral-500 hover:text-[#572280]">← Inbox</Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Submit a Vishen media link</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Drop a YouTube link to a new podcast or interview featuring Vishen. It lands in the inbox; click “Suggest clips” there to run the engine.
          </p>
        </div>
        <MediaLinkForm />
      </div>
    </main>
  );
}
