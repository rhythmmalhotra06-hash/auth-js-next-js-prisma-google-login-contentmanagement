import { Suspense } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { IntakeForm } from '@/components/intake/IntakeForm';
import { FormSkeleton } from '@/components/ui/Skeletons';

export const dynamic = 'force-dynamic';

async function IntakeBody() {
  const data = await getIntakeReferenceData();
  return <IntakeForm data={data} />;
}

export default function IntakePage() {
  return (
    <AppShell title="Creative Request Submission" subtitle="The Asset Type list narrows to options linked to your chosen Event Type.">
      <div className="mx-auto max-w-2xl rounded-[16px] border border-border-default bg-surface p-8 shadow-[var(--mv-shadow-light)]">
        <Suspense fallback={<FormSkeleton />}>
          <IntakeBody />
        </Suspense>
      </div>
    </AppShell>
  );
}
