'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { groupNav, type NavItem } from '@/lib/roles';
import { signOutAction } from '@/app/auth-actions';

export function ShellChrome({
  title, subtitle, actions, nav, roleLabel, roleDot, initials, children,
}: {
  title: string; subtitle?: string; actions?: React.ReactNode;
  nav: NavItem[]; roleLabel: string; roleDot: string; initials: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  // Only the single most-specific nav item is active — so /studio/sign-off lights up
  // "Review queue", not also "Studio" (longest matching href wins).
  const activeHref = useMemo(() => {
    const matches = nav.filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  }, [nav, pathname]);
  const { resolvedTheme, setTheme } = useTheme();

  // Close the mobile drawer on Escape (backdrop tap is handled by .side-scrim).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <>
    <div id="atmo" />
    <div className="app">
      {menu && <div className="side-scrim" onClick={() => setMenu(false)} aria-hidden />}
      <aside className={cn('side', menu && 'show')}>
        <Link href="/studio" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark"><Icon name="play" size={16} /></div>
          <div className="brand-txt"><b>Content Portal</b><span>Creative services</span></div>
        </Link>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groupNav(nav).map(({ group, items }) => (
            <div key={group} style={{ display: 'contents' }}>
              <div className="nav-label">{group}</div>
              {items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenu(false)}
                    className={cn('nav', active && 'active')}>
                    <Icon name={item.icon as IconName} size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="nav-label">Help</div>
          <button type="button" className="nav nav-tour"
            onClick={() => { setMenu(false); window.dispatchEvent(new Event('portal:tour')); }}>
            <Icon name="play" size={18} />
            <span>Guided tour</span>
          </button>
        </nav>
        <form action={signOutAction} style={{ marginTop: 'auto' }}>
          <button type="submit" className="nav" style={{ width: '100%', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
            <Icon name="logout" size={18} />
            <span>Sign out</span>
          </button>
        </form>
        <div className="side-foot"><Icon name="refresh" size={13} /> Synced from Airtable · 2 min ago</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icobtn menu-btn" aria-label="Menu" onClick={() => setMenu((v) => !v)}>
            <Icon name="menu" size={18} />
          </button>
          <div className="tb-title"><b>{title}</b>{subtitle && <span>{subtitle}</span>}</div>
          <div className="tb-spacer" style={{ flex: 1 }} />
          {actions}
          <button className="icobtn" aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
            <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <Link href="/intake" className="btn primary sm" style={{ textDecoration: 'none' }} aria-label="New request">
            <Icon name="plus" size={14} /> <span className="btn-label">New request</span>
          </Link>
          <div className="rsw">
            <span className="cur" style={{ cursor: 'default' }}>
              <span className="rdot" style={{ background: roleDot }} />
              <span className="rsw-name">{roleLabel}</span>
            </span>
          </div>
          <span className="avatar" title={roleLabel}>{initials}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
    </>
  );
}
