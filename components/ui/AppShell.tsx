import { getAdminAccess } from '@/lib/admin/access';
import { navForRoles, effectiveRoles } from '@/lib/roles';
import { ShellChrome } from '@/components/ui/ShellChrome';
import { AskPanel } from '@/components/ui/AskPanel';
import { Tour } from '@/components/ui/Tour';

function roleLabel(roles: string[], isAdmin: boolean): { label: string; dot: string } {
  const r = effectiveRoles(roles);
  if (r.includes('Executive / CEO')) return { label: 'Founder', dot: 'var(--gold)' };
  if (isAdmin || r.includes('Admin')) return { label: 'Admin', dot: 'var(--brand-bright)' };
  if (r.includes('Manager') || r.includes('Approver')) return { label: 'Creative manager', dot: 'var(--brand)' };
  if (r.includes('Editor') || r.includes('Designer')) return { label: 'Editor / designer', dot: 'var(--blue)' };
  return { label: 'Stakeholder', dot: 'var(--green)' };
}

// Global app shell: prototype chrome (sidebar + sticky topbar + content), role-scoped.
export async function AppShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { roles, isAdmin, email, division } = await getAdminAccess();
  const nav = navForRoles(roles, isAdmin, division);
  const role = roleLabel(roles, isAdmin);
  const initials =
    (email ?? 'You').split('@')[0].split(/[.\-_]/).map((s) => s[0]?.toUpperCase() ?? '').slice(0, 2).join('') || 'YOU';
  const canCreate = role.label !== 'Stakeholder';
  return (
    <ShellChrome
      title={title}
      subtitle={subtitle}
      nav={nav}
      roleLabel={role.label}
      roleDot={role.dot}
      initials={initials}
      canCreate={canCreate}
      actions={actions}
    >
      {children}
      <AskPanel />
      <Tour nav={nav} />
    </ShellChrome>
  );
}
