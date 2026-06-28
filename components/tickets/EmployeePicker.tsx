'use client';

import { useRouter } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { AssigneeOption } from '@/lib/tickets/data';

// Editor-queue assignee filter. Lists only the people tickets are actually assigned
// to — Employee creatives and Contractor/Freelancers — and is type-to-filter.
export function EmployeePicker({ assignees, value }: { assignees: AssigneeOption[]; value: string }) {
  const router = useRouter();
  return (
    <SearchableSelect
      value={value}
      onChange={(v) => router.push(v ? `/editor?assignee=${v}` : '/editor')}
      options={assignees.map((a) => ({ value: a.id, label: a.name, group: a.group }))}
      allLabel="All assignees"
      placeholder="All assignees"
      searchPlaceholder="Search people…"
      ariaLabel="Filter by assignee"
      width={260}
    />
  );
}
