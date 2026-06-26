import { AppNav } from '@/components/AppNav';
import { ClipEngineForm } from '@/components/clipping/ClipEngineForm';

export const dynamic = 'force-dynamic';

export default function NewStrategyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <AppNav active="Content Engine" />
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
          <h1 className="text-2xl font-bold text-neutral-900">New content strategy</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Paste, upload, or link a transcript. Claude returns a 10-section viral strategy; the best Reels clips can become production tickets.
          </p>
          <div className="mt-8">
            <ClipEngineForm />
          </div>
        </div>
      </div>
    </main>
  );
}
