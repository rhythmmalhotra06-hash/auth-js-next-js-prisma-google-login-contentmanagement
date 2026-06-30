'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { convertClipsToTickets } from '@/app/media/actions';

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export function ClipApprovalModal({
  clipIds,
  sourceUrl,
  reference,
  onClose,
}: {
  clipIds: string[];
  sourceUrl: string | null;
  reference: IntakeReferenceData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [eventTypeId, setEventTypeId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [officialCalendarId, setOfficialCalendarId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requesterId, setRequesterId] = useState('');
  const [teamServiceLevel, setTeamServiceLevel] = useState('Social Media Video');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAssetTypes = useMemo(
    () => (eventTypeId ? reference.assetTypes.filter((a) => a.eventTypeIds.includes(eventTypeId)) : []),
    [eventTypeId, reference.assetTypes],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await convertClipsToTickets({
      clipIds,
      eventTypeId,
      assetTypeId,
      officialCalendarId,
      dueDate,
      sourceUrl: sourceUrl ?? undefined,
      requesterId: requesterId || undefined,
      teamServiceLevel,
    });
    setSubmitting(false);
    if (res.ok) {
      router.refresh();
      onClose();
    } else if (res.created > 0) {
      router.refresh();
      setError(`Created ${res.created}, but ${res.failed.length} failed: ${res.failed[0]?.error ?? ''}`);
    } else {
      setError(res.error ?? res.failed[0]?.error ?? 'Conversion failed.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-md bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text">Create {clipIds.length} ticket{clipIds.length === 1 ? '' : 's'}</h3>
        <p className="mt-1 text-sm text-text-muted">
          Taxonomy is shared across all selected clips. Title and brief are auto-filled per clip; tickets enter the Vishen review queue.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event Type">
              <select className={inputCls} value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setAssetTypeId(''); }}>
                <option value="">Select…</option>
                {reference.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Asset Type" hint={eventTypeId ? undefined : 'Pick an Event Type first'}>
              <select className={inputCls} value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
                <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
                {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Official Calendar" hint="Optional">
              <select className={inputCls} value={officialCalendarId} onChange={(e) => setOfficialCalendarId(e.target.value)}>
                <option value="">Select…</option>
                {reference.officialCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Requested by" hint="Defaults to you">
              <select className={inputCls} value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                <option value="">Me (current user)</option>
                {reference.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Team / Service Level">
              <select className={inputCls} value={teamServiceLevel} onChange={(e) => setTeamServiceLevel(e.target.value)}>
                {reference.teamServiceLevels.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {error && <div className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-border-default pt-4">
            <button type="button" onClick={onClose} className="rounded-sm px-4 py-2 text-sm text-text-muted hover:bg-bg-subtle">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-sm px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-bright disabled:opacity-60">
              {submitting ? 'Creating…' : `Create ${clipIds.length} ticket${clipIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
