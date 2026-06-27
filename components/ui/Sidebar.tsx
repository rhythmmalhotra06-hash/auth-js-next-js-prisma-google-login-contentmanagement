'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/vishen', label: 'Cockpit', icon: '▶' },
  { href: '/intake', label: 'Intake', icon: '✎' },
  { href: '/manager', label: 'Manager', icon: '▦' },
  { href: '/editor', label: 'Editor', icon: '✦' },
  { href: '/stakeholder', label: 'Stakeholder', icon: '◉' },
  { href: '/media', label: 'Media', icon: '🎥' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-border-default bg-surface lg:flex">
      <div className="flex h-[60px] items-center gap-2.5 border-b border-border-default px-5 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-white">▶</span>
        <span className="text-[15px] font-bold tracking-tight text-text">Content Engine</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV.map((item) => {
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
      <div className="border-t border-border-default px-5 py-3 text-[11px] text-text-subtle">Mindvalley · Creative Services</div>
    </aside>
  );
}
