'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { convertClipsToTickets } from '@/app/media/actions';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

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
  const [teamServiceLevel, setTeamServiceLevel] = useState('Video Team - Non Campaign');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAssetTypes = useMemo(
    () => (eventTypeId ? reference.assetTypes.filter((a) => a.eventTypeIds.includes(eventTypeId)) : []),
    [eventTypeId, reference.assetTypes],
  );

  const label = `${clipIds.length} ticket${clipIds.length === 1 ? '' : 's'}`;

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
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3 className="text-base font-semibold">Create {label}</h3>
          <button type="button" className="icobtn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="mb">
            <p className="mb-4 text-sm text-text-muted">
              Taxonomy is shared across all selected clips. Title and brief are auto-filled per clip; tickets enter the Vishen review queue.
            </p>

            <div className="form-grid">
              <Field label="Event Type">
                <Select value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setAssetTypeId(''); }}>
                  <option value="">Select…</option>
                  {reference.eventTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                </Select>
              </Field>
              <Field label="Asset Type" hint={eventTypeId ? undefined : 'Pick an Event Type first'}>
                <Select value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
                  <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
                  {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Official Calendar" hint="Optional">
                <Select value={officialCalendarId} onChange={(e) => setOfficialCalendarId(e.target.value)}>
                  <option value="">Select…</option>
                  {reference.officialCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Requested by" hint="Defaults to you">
                <Select value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                  <option value="">Me (current user)</option>
                  {reference.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </Select>
              </Field>
              <Field label="Team / Service Level">
                <Select value={teamServiceLevel} onChange={(e) => setTeamServiceLevel(e.target.value)}>
                  {reference.teamServiceLevels.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
            </div>

            {error && <div className="mt-4 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger-content">{error}</div>}
          </div>

          <div className="mf">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : `Create ${label}`}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
