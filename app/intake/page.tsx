import { getIntakeReferenceData } from '@/lib/intake/data';
import { IntakeForm } from '@/components/intake/IntakeForm';

export const dynamic = 'force-dynamic';

export default async function IntakePage() {
  const data = await getIntakeReferenceData();

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
        <h1 className="text-2xl font-bold text-neutral-900">Creative Request Submission</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Submit a new creative request. The Asset Type list narrows to options linked to your chosen Event Type.
        </p>
        <div className="mt-8">
          <IntakeForm data={data} />
        </div>
      </div>
    </main>
  );
}
