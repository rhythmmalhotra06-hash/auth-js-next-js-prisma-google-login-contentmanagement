import { AppShell } from '@/components/ui/AppShell';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { IntakeForm } from '@/components/intake/IntakeForm';

export const dynamic = 'force-dynamic';

export default async function IntakePage() {
  const data = await getIntakeReferenceData();

  return (
    <AppShell title="Creative Request Submission" subtitle="The Asset Type list narrows to options linked to your chosen Event Type.">
      <div className="mx-auto max-w-2xl rounded-[16px] border border-border-default bg-surface p-8 shadow-[var(--mv-shadow-light)]">
        <IntakeForm data={data} />
      </div>
    </AppShell>
  );
}
