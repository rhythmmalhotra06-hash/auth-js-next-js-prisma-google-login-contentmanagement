import { listActiveTickets } from '@/lib/repositories/ticket.repository';
import { StatusSelect } from '@/components/airtable-poc/StatusSelect';

// POC: prove the Airtable-direct pattern end-to-end (read live tickets + write a
// status change) with NO Postgres in the path. Temporary; folds into the real
// queue views once the pivot lands.
export const dynamic = 'force-dynamic';

export default async function AirtablePocPage() {
  const res = await listActiveTickets(50);

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-5xl px-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Airtable-direct POC</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Live tickets read straight from the Airtable Prio Requests table. Changing a status writes
            back to Airtable — no Postgres involved.
          </p>
        </div>

        {!res.ok ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Airtable read failed: <b>{res.error.type}</b> — {res.error.message}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Priority Status</th>
                  <th className="px-4 py-2">Ticket Status</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((t) => (
                  <tr key={t.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-medium text-neutral-900">{t.title}</td>
                    <td className="px-4 py-2 text-neutral-600">{t.prioStatus ?? '—'}</td>
                    <td className="px-4 py-2"><StatusSelect recordId={t.id} current={t.ticketStatus} /></td>
                    <td className="px-4 py-2 text-neutral-600">{t.dueDate ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600">{t.score ?? '—'}</td>
                  </tr>
                ))}
                {res.data.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400">No active tickets.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
