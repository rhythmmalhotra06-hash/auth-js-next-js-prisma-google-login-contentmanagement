import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { listStrategies } from '@/lib/clipping/data';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  complete: 'bg-green-50 text-green-700',
  generating: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
};

export default async function ContentEnginePage() {
  const strategies = await listStrategies();

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <AppNav active="Content Engine" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Content Clipping Engine</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Turn a long-form transcript into a viral content strategy — then push the best clips into the production queue.
            </p>
          </div>
          <Link href="/content-engine/new" className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: '#572280' }}>
            New strategy
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          {strategies.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-500">
              No strategies yet. <Link href="/content-engine/new" className="font-medium text-[#572280]">Generate your first one.</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Clips</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {strategies.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/content-engine/${s.id}`} className="font-medium text-neutral-900 hover:text-[#572280]">
                        {s.contentSource.title}
                      </Link>
                      {s.contentSource.guestName && <span className="ml-2 text-xs text-neutral-400">{s.contentSource.guestName}</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 capitalize">{s.contentSource.sourceType}</td>
                    <td className="px-4 py-3 text-neutral-700">{s._count.clips}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.status] ?? 'bg-neutral-100 text-neutral-600'}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{s.createdAt.toLocaleDateString()}</td>
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
