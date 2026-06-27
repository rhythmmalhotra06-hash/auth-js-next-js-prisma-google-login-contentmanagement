import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { ConvertCheckedButton } from '@/components/media/ConvertCheckedButton';
import { listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  'New': 'bg-bg-subtle text-text-muted',
  'Transcribing': 'bg-amber-50 text-amber-700',
  'Clips Suggested': 'bg-green-50 text-success-content',
  'Error': 'bg-red-50 text-danger',
};

export default async function MediaInboxPage() {
  const res = await listMediaSources();
  const sources = res.ok ? res.data : [];

  return (
    <AppShell
      title="Vishen Media Inbox"
      subtitle="New podcasts & interviews featuring Vishen. Submit a YouTube link, then suggest clips for the production queue."
      actions={
        <div className="flex shrink-0 items-center gap-3">
          <ConvertCheckedButton />
          <Link href="/media/new" className="rounded-[8px] bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-bright">
            Submit link
          </Link>
        </div>
      }
    >
      {!res.ok && (
        <div className="mb-6 rounded-[8px] bg-red-50 px-4 py-3 text-sm text-danger">
          Couldn’t load the inbox from Airtable: {res.error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-[12px] bg-surface shadow-sm ring-1 ring-border-default">
        {sources.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-muted">
            No media yet. <Link href="/media/new" className="font-medium text-brand">Submit a YouTube link</Link>, or add a row directly in Airtable.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-muted text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Via</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Clips</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-bg-muted">
                  <td className="px-4 py-3">
                    <Link href={`/media/${s.id}`} className="font-medium text-text hover:text-brand">
                      {s.title || s.sourceUrl || '(untitled)'}
                    </Link>
                    {s.guestShow && <span className="ml-2 text-xs text-text-subtle">{s.guestShow}</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{s.submittedVia ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {(s.submittedDate ?? s.createdTime)?.slice(0, 10) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text">{s.clipCount || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.status ?? ''] ?? 'bg-bg-subtle text-text-muted'}`}>
                      {s.status ?? 'New'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
