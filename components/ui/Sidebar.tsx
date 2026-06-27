'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { canSeeNav } from '@/lib/roles';
import { signOutAction } from '@/app/auth-actions';

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/vishen', label: 'Clips', icon: '✂' },
  { href: '/intake', label: 'Intake', icon: '✎' },
  { href: '/manager', label: 'Manager', icon: '▦' },
  { href: '/editor', label: 'Editor', icon: '✦' },
  { href: '/stakeholder', label: 'Stakeholder', icon: '◉' },
  { href: '/media', label: 'Media', icon: '🎥' },
  { href: '/settings/clip-rules', label: 'Clip rules', icon: '⚙' },
  { href: '/settings/team', label: 'Admin panel', icon: '🛡' },
];

export function Sidebar({ roles = [], isAdmin = false, email = null }: { roles?: string[]; isAdmin?: boolean; email?: string | null }) {
  const pathname = usePathname();
  const nav = NAV.filter((item) => canSeeNav(roles, isAdmin, item.href));
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-border-default bg-surface lg:flex">
      <div className="flex h-[60px] items-center gap-2.5 border-b border-border-default px-5 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-white">▶</span>
        <span className="text-[15px] font-bold tracking-tight text-text">Content Engine</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-soft font-semibold text-brand-content' : 'text-text-muted hover:bg-bg-subtle hover:text-text',
              )}
            >
              <span className="w-4 text-center text-[13px] opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border-default px-3 py-3">
        {email && <div className="truncate px-2 pb-2 text-[11px] text-text-subtle" title={email}>{email}</div>}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-subtle hover:text-text"
          >
            <span className="w-4 text-center text-[13px] opacity-80">⏻</span>
            Sign out
          </button>
        </form>
        <div className="px-2 pt-2 text-[11px] text-text-subtle">Mindvalley · Creative Services</div>
      </div>
    </aside>
  );
}
