import Link from 'next/link';

// Role views (real role-gating arrives with Blinkwork SSO; for now all are open).
const LINKS = [
  { href: '/intake', label: 'Intake' },
  { href: '/manager', label: 'Manager' },
  { href: '/editor', label: 'Editor' },
  { href: '/stakeholder', label: 'Stakeholder' },
  { href: '/content-engine', label: 'Content Engine' },
];

export function AppNav({ active }: { active?: string }) {
  return (
    <nav className="mb-6 inline-flex gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-neutral-200">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 ${active === l.label ? 'bg-[#572280] text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
