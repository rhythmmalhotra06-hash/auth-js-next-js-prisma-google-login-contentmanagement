import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  'New': 'bg-neutral-100 text-neutral-600',
  'Transcribing': 'bg-amber-50 text-amber-700',
  'Clips Suggested': 'bg-green-50 text-green-700',
  'Error': 'bg-red-50 text-red-700',
};

export default async function MediaInboxPage() {
  const res = await listMediaSources();
  const sources = res.ok ? res.data : [];

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <AppNav active="Media" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Vishen Media Inbox</h1>
            <p className="mt-1 text-sm text-neutral-500">
              New podcasts &amp; interviews featuring Vishen. Submit a YouTube link, then suggest clips for the production queue.
            </p>
          </div>
          <Link href="/media/new" className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: '#572280' }}>
            Submit link
          </Link>
        </div>

        {!res.ok && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn’t load the inbox from Airtable: {res.error.message}
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          {sources.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-500">
              No media yet. <Link href="/media/new" className="font-medium text-[#572280]">Submit a YouTube link</Link>, or add a row directly in Airtable.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Via</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Clips</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/media/${s.id}`} className="font-medium text-neutral-900 hover:text-[#572280]">
                        {s.title || s.sourceUrl || '(untitled)'}
                      </Link>
                      {s.guestShow && <span className="ml-2 text-xs text-neutral-400">{s.guestShow}</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{s.submittedVia ?? '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {(s.submittedDate ?? s.createdTime)?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{s.clipCount || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.status ?? ''] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {s.status ?? 'New'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
