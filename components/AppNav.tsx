import Link from 'next/link';

// Role views (real role-gating arrives with Blinkwork SSO; for now all are open).
// Content Engine is superseded by the Media pipeline + Cockpit (see plan addendum).
const LINKS = [
  { href: '/vishen', label: 'Cockpit' },
  { href: '/intake', label: 'Intake' },
  { href: '/manager', label: 'Manager' },
  { href: '/editor', label: 'Editor' },
  { href: '/stakeholder', label: 'Stakeholder' },
  { href: '/media', label: 'Media' },
];

export function AppNav({ active }: { active?: string }) {
  return (
    <nav className="mb-6 inline-flex gap-1 rounded-[12px] border border-border-default bg-surface p-1 text-sm shadow-[var(--mv-shadow-light)]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            'rounded-[8px] px-3 py-1.5 transition-colors ' +
            (active === l.label
              ? 'bg-brand text-white'
              : 'text-text-muted hover:bg-bg-subtle hover:text-text')
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
