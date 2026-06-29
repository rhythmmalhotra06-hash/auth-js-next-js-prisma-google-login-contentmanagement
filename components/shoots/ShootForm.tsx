'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { SHOOT_FORMATS, SHOOT_LOCATIONS } from '@/lib/shoots/constants';
import { createShootAction } from '@/app/shoots/actions';

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
  'w-full rounded-[8px] border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-default pt-6">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function ShootForm({ data }: { data: IntakeReferenceData }) {
  const router = useRouter();
  const [requesterId, setRequesterId] = useState('');
  const [title, setTitle] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const [authorQuery, setAuthorQuery] = useState('');
  const [format, setFormat] = useState<string>(SHOOT_FORMATS[0]);
  const [shortDescription, setShortDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [productionSupport, setProductionSupport] = useState('');
  const [filmingLocation, setFilmingLocation] = useState('');
  const [filmingDate, setFilmingDate] = useState('');
  const [vishenApproved, setVishenApproved] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await createShootAction({
      title, requestedById: requesterId, format, eventTypeId, assetTypeId, authorIds,
      shortDescription, brief, productionSupport, filmingLocation, filmingDate, vishenApproved,
    });
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, message: 'Shoot request submitted — taking you to the queue…' });
      router.push('/shoots');
      router.refresh();
    } else {
      setResult({ ok: false, message: res.error ?? 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-5">
        <Field label="Your name" required hint="Who is requesting this shoot?">
          <select className={inputCls} value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
            <option value="">Select an employee…</option>
            {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Title" required hint="What are we filming?">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quest launch — studio sit-down" />
        </Field>
        <Field label="What is your format?" required>
          <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
            {SHOOT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      <Section title="What is it for?" subtitle="Optional taxonomy — links the shoot to a campaign and the assets it will feed.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="🧩 Product / Event Type" hint="Which campaign or product is this for?">
            <select className={inputCls} value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setAssetTypeId(''); }}>
              <option value="">Select an event type…</option>
              {data.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="🛎️ Asset Type" hint={eventTypeId ? 'Which asset will this feed?' : 'Pick an Event Type first'}>
            <select className={inputCls} value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
              <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
              {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Authors involved" hint="Search and add the authors you'd like to be shot (optional)">
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
            <div className="mt-1 max-h-44 overflow-y-auto rounded-[8px] border border-border-default">
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
      </Section>

      <Section title="Shoot details" subtitle="Tell the studio team what they're filming and what's needed.">
        <Field label="Short description" required>
          <input className={inputCls} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="One line on the shoot" />
        </Field>
        <Field label="Notes / brief" required hint="What's the shoot, who's in it, and what's the goal?">
          <textarea className={inputCls} rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </Field>
        <Field label="Production support" hint="Specific tech support (e.g. teleprompter) or props needed to film the asset">
          <textarea className={inputCls} rows={2} value={productionSupport} onChange={(e) => setProductionSupport(e.target.value)} />
        </Field>
      </Section>

      <Section title="Scheduling" subtitle="Where and when — if you know it.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="📍 Filming location" hint="Optional — in case you have this information">
            <select className={inputCls} value={filmingLocation} onChange={(e) => setFilmingLocation(e.target.value)}>
              <option value="">Select…</option>
              {SHOOT_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="📆 Filming date" hint="Optional — if a date is set">
            <input type="date" className={inputCls} value={filmingDate} onChange={(e) => setFilmingDate(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={vishenApproved} onChange={(e) => setVishenApproved(e.target.checked)} />
          Vishen&rsquo;s approval — tick if this request is already approved by Vishen. If not, leave it blank and we&rsquo;ll get Vishen to review.
        </label>
      </Section>

      {result && (
        <div className={`rounded-[8px] px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-danger'}`}>
          {result.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border-default pt-6">
        <button type="submit" disabled={submitting}
          className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit shoot request'}
        </button>
      </div>
    </form>
  );
}
