import Link from 'next/link';
import { Sidebar } from '@/components/ui/Sidebar';
import { getAdminAccess } from '@/lib/admin/access';

// Global app shell: fixed left sidebar (section nav) + sticky topbar (page title +
// user) + scrollable content. Tokenized; replaces the inline AppNav pill.
export async function AppShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { roles, isAdmin } = await getAdminAccess();
  return (
    <div className="min-h-screen bg-bg-muted">
      <Sidebar roles={roles} isAdmin={isAdmin} />
      <div className="lg:pl-[236px]">
        <header className="sticky top-0 z-20 border-b border-border-default bg-surface/85 backdrop-blur">
          <div className="flex h-[60px] items-center justify-between gap-4 px-6 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-bold tracking-tight text-text">{title}</h1>
              {subtitle && <p className="truncate text-[12.5px] text-text-muted">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <Link href="/intake" className="hidden h-9 items-center rounded-[8px] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-bright sm:inline-flex">
                + New request
              </Link>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-content">VL</span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
      </div>
    </div>
  );
}
