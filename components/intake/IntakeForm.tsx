'use client';

import { useMemo, useState } from 'react';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { createTicket } from '@/app/intake/actions';

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-default pt-6">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function IntakeForm({ data }: { data: IntakeReferenceData }) {
  const [requesterId, setRequesterId] = useState('');
  const [title, setTitle] = useState('');
  const [teamServiceLevel, setTeamServiceLevel] = useState('');
  const [typeOfRequest, setTypeOfRequest] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [officialCalendarId, setOfficialCalendarId] = useState('');
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const [authorQuery, setAuthorQuery] = useState('');
  const [shootIds, setShootIds] = useState<string[]>([]);
  const [shootQuery, setShootQuery] = useState('');
  const [creativeBrief, setCreativeBrief] = useState('');
  const [cta, setCta] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sourceLinks, setSourceLinks] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Asset Type is filtered to those linked to the chosen Event Type.
  const filteredAssetTypes = useMemo(
    () => (eventTypeId ? data.assetTypes.filter((a) => a.eventTypeIds.includes(eventTypeId)) : []),
    [eventTypeId, data.assetTypes],
  );

  const authorMatches = useMemo(() => {
    const q = authorQuery.trim().toLowerCase();
    if (!q) return [];
    return data.authors.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 30);
  }, [authorQuery, data.authors]);

  const selectedAuthors = data.authors.filter((a) => authorIds.includes(a.id));

  const shootMatches = useMemo(() => {
    const q = shootQuery.trim().toLowerCase();
    if (!q) return [];
    return data.shoots.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
  }, [shootQuery, data.shoots]);

  const selectedShoots = data.shoots.filter((s) => shootIds.includes(s.id));

  function onEventTypeChange(id: string) {
    setEventTypeId(id);
    setAssetTypeId(''); // reset dependent field
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await createTicket({
      requesterId, title, teamServiceLevel, typeOfRequest, eventTypeId, assetTypeId,
      officialCalendarId, authorIds, shootIds, creativeBrief, cta, dueDate, sourceLinks, notes,
    });
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, message: `Request submitted — ticket ${res.ticketId?.slice(0, 8)}…` });
      // reset
      setRequesterId(''); setTitle(''); setTeamServiceLevel(''); setTypeOfRequest('');
      setEventTypeId(''); setAssetTypeId(''); setOfficialCalendarId(''); setAuthorIds([]); setShootIds([]);
      setCreativeBrief(''); setCta(''); setDueDate(''); setSourceLinks(''); setNotes('');
    } else {
      setResult({ ok: false, message: res.error ?? 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Requester + project */}
      <div className="space-y-5">
        <Field label="Requested By" required hint="Drives team / department / division / team-lead lookups downstream">
          <select className={inputCls} value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
            <option value="">Select an employee…</option>
            {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Project/Program" required hint="Which project or program is this for? (max 40 characters)">
          <input className={inputCls} maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mastery Summit 2026" />
          <p className="text-right text-xs text-text-subtle">{title.length}/40</p>
        </Field>
        <Field label="Team/Service Level" required hint="Which team is this request for?">
          <select className={inputCls} value={teamServiceLevel} onChange={(e) => setTeamServiceLevel(e.target.value)}>
            <option value="">Select…</option>
            {data.teamServiceLevels.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      <Section title="Categorization" subtitle="Asset Type is filtered to options linked to the chosen Event Type.">
        <Field label="Type of Request" required hint="Choose if it is a video or a design request">
          <select className={inputCls} value={typeOfRequest} onChange={(e) => setTypeOfRequest(e.target.value)}>
            <option value="">Select…</option>
            {data.typesOfRequest.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="🧩 Event Type" required hint="Which campaign is this for?">
            <select className={inputCls} value={eventTypeId} onChange={(e) => onEventTypeChange(e.target.value)}>
              <option value="">Select an event type…</option>
              {data.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="🛎️ Asset Type" required hint={eventTypeId ? 'Choose the asset to be delivered' : 'Pick an Event Type first'}>
            <select className={inputCls} value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
              <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
              {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="📅 Official Calendar" hint="Optional — link to a campaign so we know its start/end dates">
          <select className={inputCls} value={officialCalendarId} onChange={(e) => setOfficialCalendarId(e.target.value)}>
            <option value="">Select a campaign…</option>
            {data.officialCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Speakers/Authors" hint="Search and add confirmed authors/speakers (optional)">
          {selectedAuthors.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedAuthors.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand">
                  {a.name}
                  <button type="button" onClick={() => setAuthorIds((ids) => ids.filter((x) => x !== a.id))} className="font-bold">×</button>
                </span>
              ))}
            </div>
          )}
          <input className={inputCls} value={authorQuery} onChange={(e) => setAuthorQuery(e.target.value)} placeholder="Type to search authors…" />
          {authorMatches.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-sm border border-border-default">
              {authorMatches.map((a) => {
                const sel = authorIds.includes(a.id);
                return (
                  <button type="button" key={a.id}
                    onClick={() => setAuthorIds((ids) => (sel ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-muted ${sel ? 'text-brand font-medium' : 'text-text'}`}>
                    {sel ? '✓ ' : ''}{a.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
        <Field label="📺 Raw Asset Source & Shoots" hint="Optional — link the shoot(s)/raw asset source this request draws from">
          {selectedShoots.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedShoots.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand">
                  {s.name}
                  <button type="button" onClick={() => setShootIds((ids) => ids.filter((x) => x !== s.id))} className="font-bold">×</button>
                </span>
              ))}
            </div>
          )}
          <input className={inputCls} value={shootQuery} onChange={(e) => setShootQuery(e.target.value)} placeholder="Type to search shoots / raw assets…" />
          {shootMatches.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-sm border border-border-default">
              {shootMatches.map((s) => {
                const sel = shootIds.includes(s.id);
                return (
                  <button type="button" key={s.id}
                    onClick={() => setShootIds((ids) => (sel ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-muted ${sel ? 'text-brand font-medium' : 'text-text'}`}>
                    {sel ? '✓ ' : ''}{s.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </Section>

      <Section title="Request Details" subtitle="Describe the scope and primary message for this request.">
        <Field label="Creative Brief" required hint="What is the key message or angle for this creative?">
          <textarea className={inputCls} rows={4} value={creativeBrief} onChange={(e) => setCreativeBrief(e.target.value)} />
        </Field>
        <Field label="Call to action" hint="URL or instruction — what the asset should drive">
          <input className={inputCls} value={cta} onChange={(e) => setCta(e.target.value)} />
        </Field>
      </Section>

      <Section title="Scheduling & Priority" subtitle="Set the deadline. Priority and assignee are handled by the backend.">
        <Field label="Due date" required>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </Section>

      <Section title="Outputs & Notes" subtitle="Optional links and notes for collaborators.">
        <Field label="Raw File / Source URL / Stage Talk Links">
          <input className={inputCls} value={sourceLinks} onChange={(e) => setSourceLinks(e.target.value)} />
        </Field>
        <Field label="V's Notes">
          <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Section>

      {result && (
        <div className={`rounded-sm px-4 py-3 text-sm ${result.ok ? 'bg-success-soft text-success-content' : 'bg-danger-soft text-danger'}`}>
          {result.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border-default pt-6">
        <button type="submit" disabled={submitting}
          className="rounded-sm bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </form>
  );
}
