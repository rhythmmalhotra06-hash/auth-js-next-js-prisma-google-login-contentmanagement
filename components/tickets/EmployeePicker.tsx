'use client';

import { useRouter } from 'next/navigation';

// Stand-in for "the logged-in editor" until Blinkwork SSO maps a session → employee.
export function EmployeePicker({ employees, value }: { employees: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => router.push(e.target.value ? `/editor?assignee=${e.target.value}` : '/editor')}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20"
    >
      <option value="">All editors</option>
      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  );
}
