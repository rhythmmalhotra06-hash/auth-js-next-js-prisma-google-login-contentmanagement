'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitMediaLink } from '@/app/media/actions';

const inputCls =
  'w-full rounded-[8px] border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export function MediaLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [guestShow, setGuestShow] = useState('');
  const [audience, setAudience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await submitMediaLink({ url, title, guestShow, audience });
    setSubmitting(false);
    if (res.ok && res.id) {
      router.push(`/media/${res.id}`);
    } else {
      setError(res.error ?? 'Failed to submit.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[12px] bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <Field label="YouTube URL" hint="v1 supports YouTube links only.">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
      </Field>
      <Field label="Title" hint="Optional — auto-filled from YouTube when we fetch the transcript.">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode / interview title" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest / Show" hint="Optional context for the clip prompt.">
          <input className={inputCls} value={guestShow} onChange={(e) => setGuestShow(e.target.value)} placeholder="e.g. The Diary of a CEO" />
        </Field>
        <Field label="Audience">
          <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="">—</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
          </select>
        </Field>
      </div>

      {error && <div className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-border-default pt-4">
        <button type="submit" disabled={submitting} className="rounded-[8px] px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-bright disabled:opacity-60">
          {submitting ? 'Adding…' : 'Add to inbox'}
        </button>
      </div>
    </form>
  );
}
