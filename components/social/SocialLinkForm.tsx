'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';

export interface CalendarOption {
  id: string;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
}

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

export function SocialLinkForm({ calendars }: { calendars: CalendarOption[] }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarOptions: SelectOption[] = useMemo(
    () =>
      calendars.map((c) => ({
        value: c.id,
        label: c.startDate ? `${c.name} · ${c.startDate.slice(0, 10)}` : c.name,
      })),
    [calendars],
  );
  const calendarName = calendars.find((c) => c.id === calendarId)?.name ?? '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/social/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, calendarId, calendarName, transcript }),
      });
      const data = (await res.json()) as { ok: boolean; count?: number; error?: string };
      if (data.ok) {
        router.push('/social');
        router.refresh();
      } else {
        setError(data.error ?? 'Generation failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <Field label="Media URL" hint="Paste a YouTube link — we transcribe it and draft ranked, platform-ready clip suggestions.">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
      </Field>
      <Field label="Calendar entry" hint="Which calendar entry are these clips for? We link the clips to it and its name flows into the Social record.">
        {calendarOptions.length > 0 ? (
          <SearchableSelect
            value={calendarId}
            onChange={setCalendarId}
            options={calendarOptions}
            placeholder="Select a calendar entry…"
            searchPlaceholder="Search calendar…"
            allLabel="No calendar entry"
          />
        ) : (
          <p className="text-xs text-text-muted">No calendar entries could be loaded from Airtable.</p>
        )}
      </Field>
      <Field label="Transcript" hint="Optional — paste a transcript if the link can't be auto-fetched.">
        <textarea className={`${inputCls} min-h-24`} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste transcript text (optional)…" />
      </Field>

      {error && <div className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-border-default pt-4">
        <button type="submit" disabled={submitting || !url.trim()} className="rounded-sm px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-bright disabled:opacity-60">
          {submitting ? 'Generating…' : 'Generate clip suggestions'}
        </button>
      </div>
    </form>
  );
}
