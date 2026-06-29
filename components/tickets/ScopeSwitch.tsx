'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { RequestScope } from '@/lib/tickets/data';

interface CalOption { value: string; label: string }

/** Scope switch for the requests view (E9.3): My requests / My team / Campaign / All. */
export function ScopeSwitch({
  scope, canViewAll, hasTeam, calendars, calendarId,
}: {
  scope: RequestScope;
  canViewAll: boolean;
  hasTeam: boolean;
  calendars: CalOption[];
  calendarId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: RequestScope, cal?: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set('scope', next);
    if (next === 'campaign' && cal) sp.set('cal', cal);
    else sp.delete('cal');
    router.push(`/stakeholder?${sp.toString()}`);
  }

  const tabs: { key: RequestScope; label: string; disabled?: boolean }[] = [
    { key: 'mine', label: 'My requests' },
    { key: 'team', label: 'My team', disabled: !hasTeam },
    { key: 'campaign', label: 'Campaign' },
    ...(canViewAll ? [{ key: 'all' as const, label: 'All' }] : []),
  ];

  return (
    <div className="filters" style={{ marginBottom: 12 }}>
      <div className="sortchips">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`chipbtn${scope === t.key ? ' on' : ''}`}
            disabled={t.disabled}
            title={t.disabled ? 'You’re not on a team yet' : undefined}
            onClick={() => go(t.key, t.key === 'campaign' ? calendarId : undefined)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {scope === 'campaign' && (
        <SearchableSelect
          value={calendarId ?? ''}
          allLabel="Pick a campaign"
          placeholder="Pick a campaign"
          ariaLabel="Campaign"
          searchPlaceholder="Search campaigns…"
          options={calendars}
          onChange={(v) => go('campaign', v)}
        />
      )}
    </div>
  );
}
