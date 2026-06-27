import { diagnoseSchema } from '@/lib/admin/db-repair';
import { RepairButton } from '@/components/admin/RepairButton';

// TEMPORARY admin page — diagnose + repair the app's real database schema.
// Page route (not /api) so it isn't shadowed by the NextAuth catch-all; middleware
// already requires login. Remove once the DB is reconciled.
export const dynamic = 'force-dynamic';

export default async function DbRepairPage() {
  const diag = await diagnoseSchema();
  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-3xl px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">DB Repair (temporary)</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Runs on the app&apos;s own database connection. Diagnose shows the real DB + schema gaps;
            Repair applies idempotent DDL to align it.
          </p>
        </div>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Diagnosis</h2>
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
{JSON.stringify(diag, null, 2)}
          </pre>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Repair</h2>
          <RepairButton />
        </section>
      </div>
    </main>
  );
}
