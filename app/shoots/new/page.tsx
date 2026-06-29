import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { ShootForm } from '@/components/shoots/ShootForm';
import { FormSkeleton } from '@/components/ui/Skeletons';

export const dynamic = 'force-dynamic';

async function ShootBody() {
  const data = await getIntakeReferenceData();
  return <ShootForm data={data} />;
}

export default function NewShootPage() {
  return (
    <AppShell
      title="Shoot &amp; production request"
      subtitle="Want to film or shoot something? Approved shoots flow into the studio queue and link to the tickets they feed."
    >
      <Link href="/intake" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Request type</Link>
      <div className="mx-auto max-w-2xl rounded-[16px] border border-border-default bg-surface p-8 shadow-[var(--mv-shadow-light)]">
        <Suspense fallback={<FormSkeleton />}>
          <ShootBody />
        </Suspense>
      </div>
    </AppShell>
  );
}
