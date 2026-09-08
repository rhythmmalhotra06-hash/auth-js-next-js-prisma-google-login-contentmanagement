import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { IntakeForm } from '@/components/intake/IntakeForm';
import { FormSkeleton } from '@/components/ui/Skeletons';
import { getAdminAccess } from '@/lib/admin/access';
import { canRaiseAnyAssetType } from '@/lib/intake/entitlement';

export const dynamic = 'force-dynamic';

async function IntakeBody() {
  const [data, access] = await Promise.all([getIntakeReferenceData(), getAdminAccess()]);
  // Asset types are gated by Airtable's "Stakeholder" field; admins/managers see everything
  // (nobody has listed them as a stakeholder, so a strict filter would show them nothing).
  return (
    <IntakeForm
      data={data}
      sessionEmail={access.email}
      unrestricted={canRaiseAnyAssetType(access.roles, access.isAdmin)}
    />
  );
}

export default function CreativeIntakePage() {
  return (
    <AppShell title="Creative Request Submission" subtitle="The Asset Type list narrows to options linked to your chosen Event Type.">
      <Link href="/intake" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Request type</Link>
      <div className="mx-auto max-w-2xl rounded-lg border border-border-default bg-surface p-8 shadow-[var(--mv-shadow-light)]">
        <Suspense fallback={<FormSkeleton />}>
          <IntakeBody />
        </Suspense>
      </div>
    </AppShell>
  );
}
