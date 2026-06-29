import { AppShell } from '@/components/ui/AppShell';
import { Icon } from '@/components/ui/Icon';
import { ShootsBoard } from '@/components/shoots/ShootsBoard';
import { listShoots } from '@/lib/shoots/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';

export const dynamic = 'force-dynamic';

export default async function ShootsPage() {
  const [res, ref] = await Promise.all([listShoots(), getIntakeReferenceData()]);
  const rows = res.ok ? res.data : [];
  const employeeNames: Record<string, string> = Object.fromEntries(ref.employees.map((e) => [e.id, e.name]));

  return (
    <AppShell title="Shoots" subtitle="Pre-production filming requests → studio queue → production tickets.">
      <div className="banner" style={{ marginBottom: 16 }}>
        <Icon name="video" size={18} />
        <div>
          Anyone who wants to <b>film or shoot</b> submits a shoot request. Approved shoots flow into the studio
          queue and link to the production tickets they feed.
        </div>
      </div>

      {!res.ok && (
        <div className="banner" style={{ background: 'var(--red-soft)', color: 'var(--red-content)', marginBottom: 16 }}>
          <Icon name="bolt" size={18} /> <div>Couldn’t load shoots from Airtable: {res.error.message}</div>
        </div>
      )}

      <ShootsBoard rows={rows} employeeNames={employeeNames} />
    </AppShell>
  );
}
